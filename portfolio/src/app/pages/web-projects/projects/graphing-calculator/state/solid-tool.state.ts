import {
  Injectable,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { evalExpression, evaluate } from '../engine/evaluator';
import { solveConicForY } from '../engine/conic-solver';
import { parseLimitText, type ParsedLimit } from '../engine/parse-limit';
import { computeSolid } from '../engine/solids';
import { curveModeMatchesVariable, validateSolidSpec } from '../engine/solids/solid-validation';
import type {
  CrossSectionShape,
  IntegrationVariable,
  SolidCurve,
  SolidIssue,
  SolidMethod,
  SolidResult,
  SolidSpec,
} from '../engine/solids/solid.types';
import type { DetectedCurveMode } from '../engine/mode-detector';
import type { MathExpression } from '../models/calculator.models';

export type SolidFieldKey = 'curves' | 'a' | 'b' | 'axis' | 'shape' | 'ratio';

/** One row of the curve-selection checklist rendered by the solid panel. */
export interface SolidCurveOption {
  index: number;
  fn: MathExpression;
  selected: boolean;
  compatible: boolean;
  /** Reason the checkbox is disabled, shown as a tooltip; empty when compatible. */
  reason: string;
}

const MAX_CURVES = 2;
const SWEEP_DURATION_MS = 4000;
const DEFAULT_METHOD: SolidMethod = 'disk-washer';

function methodOrientation(
  method: SolidMethod,
  variable: IntegrationVariable,
): 'horizontal' | 'vertical' {
  if (method === 'disk-washer') return variable === 'x' ? 'horizontal' : 'vertical';
  return variable === 'x' ? 'vertical' : 'horizontal';
}

/** Whether a function row can be used as a solid curve for the given integration variable. */
function curveCompatible(fn: MathExpression, variable: IntegrationVariable): boolean {
  if (fn.mode === 'explicit' || fn.mode === 'explicit-y') {
    return curveModeMatchesVariable(fn.mode as DetectedCurveMode, variable);
  }
  // Parametric / polar / implicit-conic curves are only usable through the x-parameterised
  // adapters below, so they're only offered when the integration variable is x.
  return variable === 'x';
}

function incompatibilityReason(fn: MathExpression, variable: IntegrationVariable): string {
  if (fn.mode === 'explicit-y' && variable === 'x') return 'x = g(y) rows need variable y.';
  if (fn.mode === 'explicit' && variable === 'y') return 'y = f(x) rows need variable x.';
  if (variable === 'y') return 'Parametric, polar and implicit curves only support variable x.';
  return 'This curve is undefined or unusable with the current selection.';
}

/**
 * State for the "solids by integration" tool panel: curve/method/bounds selection, the derived
 * SolidSpec, validation issues, the computed SolidResult, and the sweep-animation loop.
 * Provided at the calculator component level so the panel, canvas and 3D view share one instance.
 */
@Injectable()
export class SolidToolState implements OnDestroy {
  private ngZone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private functionsSignal: Signal<MathExpression[]> = signal([]);
  private angleUnitSignal: Signal<'deg' | 'rad'> = signal('rad');

  method = signal<SolidMethod>(DEFAULT_METHOD);
  curveIndices = signal<number[]>([]);
  aText = signal('0');
  bText = signal('1');
  axisValueText = signal('0');
  shape = signal<CrossSectionShape>('square');
  heightRatioText = signal('1');
  sweepT = signal<number | null>(null);
  playing = signal(false);

  private rafId: number | null = null;

  /** Wires the function list (and optional angle unit) this tool reads curves from. */
  connect(functions: Signal<MathExpression[]>, angleUnit?: Signal<'deg' | 'rad'>): void {
    this.functionsSignal = functions;
    if (angleUnit) this.angleUnitSignal = angleUnit;
  }

  functions = computed(() => this.functionsSignal());

  private aParsed = computed<ParsedLimit>(() => parseLimitText(this.aText()));
  private bParsed = computed<ParsedLimit>(() => parseLimitText(this.bText()));
  private axisValueParsed = computed<ParsedLimit>(() => parseLimitText(this.axisValueText()));
  private heightRatioParsed = computed<ParsedLimit>(() => parseLimitText(this.heightRatioText()));

  a = computed(() => this.aParsed().value ?? NaN);
  b = computed(() => this.bParsed().value ?? NaN);
  axisValue = computed(() => this.axisValueParsed().value ?? NaN);
  heightRatio = computed(() => this.heightRatioParsed().value ?? undefined);

  /** Inferred from the first selected curve compatible with an explicit variable; 'x' by default. */
  variable = computed<IntegrationVariable>(() => {
    const fns = this.functionsSignal();
    for (const idx of this.curveIndices()) {
      const fn = fns[idx];
      if (!fn) continue;
      if (fn.mode === 'explicit-y') return 'y';
      if (fn.mode === 'explicit') return 'x';
    }
    return 'x';
  });

  /** Derived, not chosen: the axis orientation implied by method + variable. */
  axisOrientation = computed(() => methodOrientation(this.method(), this.variable()));

  curveOptions = computed<SolidCurveOption[]>(() => {
    const variable = this.variable();
    const selected = this.curveIndices();
    return this.functionsSignal().map((fn, index) => {
      const compatible = fn.visible && curveCompatible(fn, variable);
      return {
        index,
        fn,
        selected: selected.includes(index),
        compatible,
        reason: compatible ? '' : incompatibilityReason(fn, variable),
      };
    });
  });

  private selectedCurves = computed<SolidCurve[]>(() => {
    const fns = this.functionsSignal();
    const variable = this.variable();
    const au = this.angleUnitSignal();
    const curves: SolidCurve[] = [];
    let n = 0;
    for (const idx of this.curveIndices()) {
      const fn = fns[idx];
      if (!fn || !fn.visible || !curveCompatible(fn, variable)) continue;
      const built = buildCurve(fn, idx, au);
      if (!built) continue;
      curves.push(built);
      n++;
      if (n >= MAX_CURVES) break;
    }
    return curves;
  });

  spec = computed<SolidSpec | null>(() => {
    const curves = this.selectedCurves();
    if (curves.length === 0) return null;
    const method = this.method();
    const variable = this.variable();
    const spec: SolidSpec = { method, variable, curves, a: this.a(), b: this.b() };
    if (method === 'disk-washer' || method === 'shell') {
      spec.axis = { orientation: this.axisOrientation(), value: this.axisValue() };
    } else {
      spec.shape = this.shape();
      if (spec.shape === 'rectangle') spec.heightRatio = this.heightRatio();
    }
    return spec;
  });

  private staticIssues = computed<SolidIssue[]>(() => {
    const spec = this.spec();
    if (!spec) {
      return [
        {
          code: 'no-curves',
          severity: 'error',
          message: 'Select at least one curve for the solid.',
          field: 'curves',
        },
      ];
    }
    return validateSolidSpec(spec);
  });

  result = computed<SolidResult | null>(() => {
    const spec = this.spec();
    if (!spec) return null;
    if (this.staticIssues().some((i) => i.severity === 'error')) return null;
    return computeSolid(spec);
  });

  issues = computed<SolidIssue[]>(() => [...this.staticIssues(), ...(this.result()?.issues ?? [])]);

  fieldErrors = computed<Partial<Record<SolidFieldKey, string>>>(() => {
    const errs: Partial<Record<SolidFieldKey, string>> = {};
    if (this.aParsed().invalid) errs.a = 'Enter a number or expression, e.g. pi.';
    if (this.bParsed().invalid) errs.b = 'Enter a number or expression, e.g. pi.';
    const method = this.method();
    if ((method === 'disk-washer' || method === 'shell') && this.axisValueParsed().invalid) {
      errs.axis = 'Enter a number or expression, e.g. pi.';
    }
    if (
      method === 'cross-section' &&
      this.shape() === 'rectangle' &&
      this.heightRatioParsed().invalid
    ) {
      errs.ratio = 'Enter a number or expression, e.g. pi.';
    }
    for (const issue of this.issues()) {
      if (issue.severity === 'error' && issue.field && !errs[issue.field]) {
        errs[issue.field] = issue.message;
      }
    }
    return errs;
  });

  sweepArea = computed<number | null>(() => {
    const result = this.result();
    const t = this.sweepT();
    if (!result || t === null) return null;
    const v = result.sliceArea(t);
    return Number.isFinite(v) ? v : null;
  });

  setMethod(method: SolidMethod): void {
    this.method.set(method);
  }

  toggleCurve(index: number): void {
    this.curveIndices.update((cur) => {
      if (cur.includes(index)) return cur.filter((i) => i !== index);
      if (cur.length >= MAX_CURVES) return cur;
      return [...cur, index].sort((x, y) => x - y);
    });
  }

  setA(text: string): void {
    this.aText.set(text);
  }

  setB(text: string): void {
    this.bText.set(text);
  }

  setAxisValue(text: string): void {
    this.axisValueText.set(text);
  }

  setShape(shape: CrossSectionShape): void {
    this.shape.set(shape);
  }

  setHeightRatio(text: string): void {
    this.heightRatioText.set(text);
  }

  /** Keeps curveIndices consistent when a function row is deleted elsewhere in the calculator. */
  handleFunctionRemoved(index: number): void {
    this.curveIndices.update((idxs) =>
      idxs.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
    );
  }

  /** Keeps curveIndices consistent when function rows are reordered via drag-and-drop. */
  handleFunctionMoved(sourceIndex: number, targetIndex: number): void {
    this.curveIndices.update((idxs) =>
      idxs.map((i) => {
        if (i === sourceIndex) return targetIndex;
        if (sourceIndex < targetIndex && i > sourceIndex && i <= targetIndex) return i - 1;
        if (sourceIndex > targetIndex && i >= targetIndex && i < sourceIndex) return i + 1;
        return i;
      }),
    );
  }

  setSweepT(t: number): void {
    this.pause();
    this.sweepT.set(t);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Starts (or restarts) the sweep animation from a to b over ~4s. Never called automatically. */
  play(): void {
    if (!this.isBrowser) return;
    const a = this.a();
    const b = this.b();
    if (!this.spec() || !Number.isFinite(a) || !Number.isFinite(b) || b <= a) return;

    if (this.prefersReducedMotion()) {
      this.sweepT.set(b);
      this.playing.set(false);
      return;
    }

    this.playing.set(true);
    const start = performance.now();
    this.ngZone.runOutsideAngular(() => {
      const step = (now: number) => {
        if (!this.playing()) return;
        const frac = Math.min(1, (now - start) / SWEEP_DURATION_MS);
        this.sweepT.set(a + frac * (b - a));
        if (frac >= 1) {
          this.rafId = null;
          this.playing.set(false);
          return;
        }
        this.rafId = requestAnimationFrame(step);
      };
      this.rafId = requestAnimationFrame(step);
    });
  }

  pause(): void {
    this.playing.set(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset(): void {
    this.pause();
    this.sweepT.set(null);
  }

  ngOnDestroy(): void {
    this.pause();
  }
}

/** Builds a SolidCurve adapter for a function row, matching the calculator's existing evaluation
 *  paths per curve mode. Returns null when the row can't be evaluated (e.g. an implicit curve with
 *  no explicit-y branch). */
function buildCurve(fn: MathExpression, index: number, au: 'deg' | 'rad'): SolidCurve | null {
  const label = `f${index + 1}`;
  if (fn.mode === 'explicit' && fn.ast) {
    const ast = fn.ast;
    return { fn: (x) => evalExpression(ast, x, undefined, au), ast, label, color: fn.color };
  }
  if (fn.mode === 'explicit-y' && fn.ast) {
    const ast = fn.ast;
    return { fn: (y) => evaluate(ast, { y }, au), ast, label, color: fn.color };
  }
  if (fn.mode === 'implicit' && fn.ast) {
    const branches = solveConicForY(fn.ast);
    if (!branches || branches.length === 0) return null;
    const branchFn = branches[0].fn;
    return { fn: (x) => branchFn(x) ?? NaN, ast: null, label, color: fn.color };
  }
  if (fn.mode === 'parametric' && fn.paramX && fn.paramY) {
    const evalX = (t: number) => evaluate(fn.paramX!, { x: t, t }, au);
    const evalY = (t: number) => evaluate(fn.paramY!, { x: t, t }, au);
    const tMin = evalRangeOrDefault(fn.tMin, 0);
    const tMax = evalRangeOrDefault(fn.tMax, 2 * Math.PI);
    const pts = samplePoints(evalX, evalY, tMin, tMax);
    return { fn: interpolateByX(pts), ast: null, label, color: fn.color };
  }
  if (fn.mode === 'polar' && fn.ast) {
    const ast = fn.ast;
    const evalR = (theta: number) => evalExpression(ast, theta, undefined, au);
    const thetaMin = evalRangeOrDefault(fn.thetaMin, 0);
    const thetaMax = evalRangeOrDefault(fn.thetaMax, 2 * Math.PI);
    const pts = samplePoints(
      (t) => evalR(t) * Math.cos(t),
      (t) => evalR(t) * Math.sin(t),
      thetaMin,
      thetaMax,
    );
    return { fn: interpolateByX(pts), ast: null, label, color: fn.color };
  }
  return null;
}

function evalRangeOrDefault(raw: string | undefined, fallback: number): number {
  const { value } = parseLimitText(raw ?? '');
  return value ?? fallback;
}

function samplePoints(
  evalX: (t: number) => number,
  evalY: (t: number) => number,
  tMin: number,
  tMax: number,
  n = 500,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= n; i++) {
    const t = tMin + (i / n) * (tMax - tMin);
    try {
      const x = evalX(t);
      const y = evalY(t);
      if (isFinite(x) && isFinite(y)) pts.push({ x, y });
    } catch {
      /* skip */
    }
  }
  return pts;
}

function interpolateByX(pts: Array<{ x: number; y: number }>): (x: number) => number {
  return (x: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      if ((p0.x <= x && p1.x >= x) || (p1.x <= x && p0.x >= x)) {
        const dx = p1.x - p0.x;
        if (Math.abs(dx) < 1e-15) return p0.y;
        const t = (x - p0.x) / dx;
        return p0.y + t * (p1.y - p0.y);
      }
    }
    return NaN;
  };
}
