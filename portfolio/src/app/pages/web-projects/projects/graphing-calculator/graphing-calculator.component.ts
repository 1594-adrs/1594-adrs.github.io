import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
  ElementRef,
  viewChild,
  viewChildren,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Viewport } from './canvas/viewport';
import { drawGrid } from './canvas/grid-renderer';
import { Solid3DComponent } from './canvas/solid-3d/solid-3d.component';
import { HelpModalComponent } from './help-modal/help-modal.component';
import {
  drawFunction,
  drawIntegralArea,
  drawCrosshair,
  drawAreaBetween,
  drawParametric,
  drawPolar,
  drawInequality,
  drawImplicitInequality,
  drawAsymptote,
} from './canvas/graph-renderer';
import { drawImplicitCurve } from './canvas/implicit-renderer';
import { solveConicForY } from './engine/conic-solver';
import { detectAsymptotes } from './engine/asymptote-detector';
import {
  drawSolidCrossSectionSingle,
  drawSolidCrossSectionMulti,
} from './canvas/solid-renderer';
import { parse } from './engine/parser';
import { evalExpression, evalConstantExpression } from './engine/evaluator';
import { integrate } from './engine/integrator';
import {
  solidVolumeSingle,
  solidSurfaceAreaSingle,
  areaSingle,
  solidVolumeMulti,
  solidSurfaceAreaMulti,
} from './engine/calculus';
import { findIntersections } from './engine/intersection-finder';
import { findAxisCrossings } from './canvas/utils';
import { computeAreaRegions, computeRevolutionRegions } from './engine/area-splitter';
import { FUNCTION_COLORS } from './utils/color';
import { OnscreenKeyboardComponent } from './keyboard/onscreen-keyboard.component';
import { MathRendererComponent } from './components/math-renderer/math-renderer.component';
import { ConicAssistantComponent } from './components/conic-assistant/conic-assistant.component';
import type {
  MathExpression,
  IntegralResult,
  RotationAxis,
  SolidConfig,
  MultiFunctionAreaConfig,
  CurveMode,
} from './models/calculator.models';

function formatValue(v: number): string {
  if (Number.isNaN(v)) return 'undefined';
  if (v === Number.POSITIVE_INFINITY) return 'inf';
  if (v === Number.NEGATIVE_INFINITY) return '-inf';
  if (Math.abs(v) < 1e-10) return '0';
  if (Math.abs(v) >= 1e12) return v.toExponential(3);
  if (Math.abs(v) < 0.001) return v.toExponential(3);
  return v.toFixed(6);
}

@Component({
  selector: 'app-graphing-calculator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, OnscreenKeyboardComponent, Solid3DComponent, HelpModalComponent, MathRendererComponent, ConicAssistantComponent],
  templateUrl: './graphing-calculator.component.html',
  styleUrls: ['./graphing-calculator.component.css', './results.css'],
})
export class GraphingCalculatorComponent implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private titleService = inject(Title);

  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('graphCanvas');
  fnInputs = viewChildren<ElementRef<HTMLInputElement>>('fnInput');
  helpBtn = viewChild<ElementRef<HTMLButtonElement>>('helpBtn');

  functions = signal<MathExpression[]>([
    { raw: 'sin(x)', ast: null, color: FUNCTION_COLORS[0], visible: true, mode: 'explicit' },
  ]);

  activeIntegral = signal<{ fnIndex: number; a: number; b: number } | null>(null);
  activeSolid = signal<SolidConfig | null>(null);
  activeMultiArea = signal<MultiFunctionAreaConfig | null>(null);
  angleUnit = signal<'deg' | 'rad'>('rad');
  limitErrors = signal<Record<string, boolean>>({});
  showKeyboard = signal(false);
  show3DSolid = signal(false);
  showHelp = signal(false);
  showCanvasControls = signal(false);
  showConicAssistant = signal(false);
  showGrid = signal(true);
  focusedInputIndex = signal<number | null>(null);
  evalPoint = signal<string>('0');
  dragIndex = signal<number | null>(null);

  evalResults = computed(() => {
    const point = parseFloat(this.evalPoint());
    if (isNaN(point)) return [];
    const au = this.angleUnit();
    return this.functions()
      .filter((f) => f.visible && f.ast)
      .map((f, i) => {
        const realIndex = this.functions().indexOf(f);
        try {
          const value = evalExpression(f.ast!, point, undefined, au);
          return {
            fnIndex: realIndex,
            color: f.color,
            value: isFinite(value) ? formatValue(value) : 'undefined',
          };
        } catch {
          return { fnIndex: realIndex, color: f.color, value: 'undefined' };
        }
      });
  });

  solidEvalFns = computed<Array<(x: number) => number>>(() => {
    const sol = this.activeSolid();
    if (!sol) return [];
    const au = this.angleUnit();
    return sol.functionIndices
      .map((i) => this.functions()[i])
      .filter((e) => !!e?.visible && this.canUseWithTools(e))
      .map((e) => {
        if (e.mode === 'explicit' && e.ast) {
          return (x: number) => evalExpression(e.ast!, x, undefined, au);
        }
        if (e.mode === 'implicit' && e.ast) {
          const branches = solveConicForY(e.ast);
          if (branches && branches.length > 0) {
            const branchFn = branches[0].fn;
            return (x: number) => branchFn(x) ?? NaN;
          }
          return (x: number) => evalExpression(e.ast!, x, undefined, au);
        }
        if (e.mode === 'parametric' && e.paramX && e.paramY) {
          const evalX = (t: number) => evalExpression(e.paramX!, t, undefined, au);
          const evalY = (t: number) => evalExpression(e.paramY!, t, undefined, au);
          const tMin = this.evalRange(e.tMin, 0);
          const tMax = this.evalRange(e.tMax, 2 * Math.PI);
          const N = 500;
          const pts: Array<{ x: number; y: number }> = [];
          for (let i = 0; i <= N; i++) {
            const t = tMin + (i / N) * (tMax - tMin);
            try {
              const px = evalX(t);
              const py = evalY(t);
              if (isFinite(px) && isFinite(py)) pts.push({ x: px, y: py });
            } catch { /* skip */ }
          }
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
        if (e.mode === 'polar' && e.ast) {
          const evalR = (theta: number) => evalExpression(e.ast!, theta, undefined, au);
          const thetaMin = this.evalRange(e.thetaMin, 0);
          const thetaMax = this.evalRange(e.thetaMax, 2 * Math.PI);
          const N = 500;
          const pts: Array<{ x: number; y: number }> = [];
          for (let i = 0; i <= N; i++) {
            const theta = thetaMin + (i / N) * (thetaMax - thetaMin);
            try {
              const r = evalR(theta);
              if (isFinite(r)) pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
            } catch { /* skip */ }
          }
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
        return (x: number) => NaN;
      });
  });

  solidFnColors = computed<string[]>(() => {
    const sol = this.activeSolid();
    if (!sol) return [];
    return sol.functionIndices
      .map((i) => this.functions()[i])
      .filter((e) => !!e?.visible && this.canUseWithTools(e))
      .map((e) => e.color);
  });

  solidRegions = computed(() => {
    const fns = this.solidEvalFns();
    const sol = this.activeSolid();
    if (!sol || fns.length < 1) return [];
    if (fns.length === 1) {
      return [{ a: sol.a, b: sol.b, topFunctionIndex: 0, bottomFunctionIndex: 0 }];
    }
    const intersections = findIntersections(fns, sol.a, sol.b);
    return computeRevolutionRegions(fns, intersections, sol.a, sol.b, sol.overlapMode);
  });

  hasSolidData = computed(() => {
    const sol = this.activeSolid();
    if (!sol) return false;
    return this.solidRegions().length > 0;
  });

  viewport = new Viewport();
  mousePos = signal<{ x: number; y: number } | null>(null);
  isDragging = signal(false);
  lastDrag = signal<{ x: number; y: number } | null>(null);

  private resizeObserver: ResizeObserver | null = null;
  private renderRequested = false;
  private animFrameId = 0;
  private pendingRafIds: number[] = [];
  private blurTimerId: ReturnType<typeof setTimeout> | null = null;

  private requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    this.animFrameId = requestAnimationFrame(() => {
      this.ngZone.runOutsideAngular(() => {
        this.renderRequested = false;
        this.render();
        this.cdr.markForCheck();
      });
    });
  }

  results = computed<IntegralResult[]>(() => {
    const res: IntegralResult[] = [];
    const au = this.angleUnit();
    const intg = this.activeIntegral();
    if (intg) {
      const expr = this.functions()[intg.fnIndex];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x, undefined, au);
        const value = integrate(fn, intg.a, intg.b);
        res.push({ label: `∫ ${expr.raw} dx`, value: formatValue(value) });
      }
    }
    const sol = this.activeSolid();
    if (sol) {
      const evalFns = this.solidEvalFns();
      const regions = this.solidRegions();
      const axisLabel =
        sol.axis.type === 'x' && sol.axis.value === 0
          ? 'y = 0'
          : sol.axis.type === 'y' && sol.axis.value === 0
            ? 'x = 0'
            : sol.axis.type === 'y'
              ? `x = ${sol.axis.value}`
              : `y = ${sol.axis.value}`;

      if (evalFns.length === 1 && regions.length > 0) {
        const vol = solidVolumeSingle(evalFns[0], sol.a, sol.b, sol.axis);
        const sa = solidSurfaceAreaSingle(evalFns[0], sol.a, sol.b, sol.axis);
        const fnLabel = this.functions()[sol.functionIndices[0]]?.raw ?? 'f';
        res.push({ label: `V [${axisLabel}] (${fnLabel})`, value: formatValue(vol) });
        res.push({ label: `S [${axisLabel}] (${fnLabel})`, value: formatValue(sa) });
      } else if (evalFns.length >= 2 && regions.length > 0) {
        const vol = solidVolumeMulti(evalFns, regions, sol.axis);
        const sa = solidSurfaceAreaMulti(evalFns, regions, sol.axis);
        const fnLabels = sol.functionIndices
          .map((i) => this.functions()[i]?.raw ?? `f${i + 1}`)
          .join(', ');
        res.push({ label: `V [${axisLabel}] (${fnLabels})`, value: formatValue(vol) });
        res.push({ label: `S [${axisLabel}] (${fnLabels})`, value: formatValue(sa) });
      }
    }

    const mArea = this.activeMultiArea();
    if (mArea && mArea.functionIndices.length >= 2) {
      const fns = mArea.functionIndices
        .map((i) => this.functions()[i])
        .filter(
          (e): e is MathExpression & { ast: NonNullable<MathExpression['ast']> } =>
            !!e?.ast && e.visible && this.canUseWithTools(e),
        );
      if (fns.length >= 2) {
        const evalFns = fns.map((f) => {
          if (f.mode === 'explicit') {
            return (x: number) => evalExpression(f.ast, x, undefined, au);
          }
          const branches = solveConicForY(f.ast);
          if (branches && branches.length > 0) {
            const branchFn = branches[0].fn;
            return (x: number) => branchFn(x) ?? NaN;
          }
          return (x: number) => evalExpression(f.ast, x, undefined, au);
        });
        const intersections = findIntersections(evalFns, mArea.a, mArea.b);
        const regions = computeAreaRegions(evalFns, intersections, mArea.a, mArea.b);
        let total = 0;
        for (const r of regions) total += r.area;
        const labels = fns.map((f) => f.raw).join(', ');
        res.push({ label: `A [${labels}]`, value: formatValue(total) });
      }
    } else if (mArea && mArea.functionIndices.length === 1) {
      const expr = this.functions()[mArea.functionIndices[0]];
      if (expr?.ast && expr.visible && this.canUseWithTools(expr)) {
        let fn: (x: number) => number;
        if (expr.mode === 'explicit') {
          fn = (x: number) => evalExpression(expr.ast!, x, undefined, au);
        } else {
          const branches = solveConicForY(expr.ast!);
          if (branches && branches.length > 0) {
            const branchFn = branches[0].fn;
            fn = (x: number) => branchFn(x) ?? NaN;
          } else {
            fn = (x: number) => evalExpression(expr.ast!, x, undefined, au);
          }
        }
        const value = areaSingle(fn, mArea.a, mArea.b);
        res.push({ label: `A [${expr.raw}]`, value: formatValue(value) });
      }
    }

    return res;
  });

  ngAfterViewInit(): void {
    this.titleService.setTitle('Graphing Calculator — Andres Rincon');
    if (!this.isBrowser) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ngZone.runOutsideAngular(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.requestRender());
        if (canvas.parentElement) {
          this.resizeObserver.observe(canvas.parentElement);
        }
      }
      this.parseAll();
      this.render();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.isBrowser) {
      cancelAnimationFrame(this.animFrameId);
      for (const id of this.pendingRafIds) cancelAnimationFrame(id);
      this.pendingRafIds = [];
    }
    if (this.blurTimerId !== null) {
      clearTimeout(this.blurTimerId);
      this.blurTimerId = null;
    }
  }

  addFunction(): void {
    if (this.functions().length >= 5) return;
    const idx = this.functions().length;
    this.functions.update((fns) => [
      ...fns,
      {
        raw: '',
        ast: null,
        color: FUNCTION_COLORS[idx % FUNCTION_COLORS.length],
        visible: true,
        mode: 'explicit',
      },
    ]);
  }

  removeFunction(index: number): void {
    this.functions.update((fns) => fns.filter((_, i) => i !== index));
    if (this.functions().length < 2) {
      this.activeMultiArea.set(null);
    }
    this.activeSolid.update((s) => {
      if (!s) return null;
      const newIndices = s.functionIndices
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
      return newIndices.length >= 1 ? { ...s, functionIndices: newIndices } : null;
    });
    this.requestRender();
  }

  updateExpression(index: number, raw: string): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => {
        if (i !== index) return fn;
        const mode = this.detectMode(raw);
        if (mode === 'implicit') {
          const inequalityMatch = raw.match(/(.*?)(>=|<=|>|<)(.*)/);
          if (inequalityMatch) {
            const lhs = inequalityMatch[1].trim();
            const op = inequalityMatch[2] as '>' | '<' | '>=' | '<=';
            const rhs = inequalityMatch[3].trim();
            if (/^y$/i.test(lhs)) {
              try {
                const ast = parse(rhs);
                return { ...fn, raw, ast, mode, paramX: null, paramY: null, inequalityOp: op };
              } catch {
                return { ...fn, raw, ast: null, mode, paramX: null, paramY: null, inequalityOp: op };
              }
            }
            try {
              const ast = parse(`(${lhs})-(${rhs})`);
              return { ...fn, raw, ast, mode, paramX: null, paramY: null, inequalityOp: op };
            } catch {
              return { ...fn, raw, ast: null, mode, paramX: null, paramY: null, inequalityOp: op };
            }
          }
          try {
            const ast = parse(raw);
            return { ...fn, raw, ast, mode, paramX: null, paramY: null, inequalityOp: undefined };
          } catch {
            return { ...fn, raw, ast: null, mode, paramX: null, paramY: null, inequalityOp: undefined };
          }
        }
        if (mode === 'parametric') {
          const parts = raw.split(',');
          if (parts.length === 2) {
            try {
              const paramX = parse(parts[0].trim());
              const paramY = parse(parts[1].trim());
              return { ...fn, raw, ast: null, mode, paramX, paramY, inequalityOp: undefined };
            } catch {
              return { ...fn, raw, ast: null, mode, paramX: null, paramY: null, inequalityOp: undefined };
            }
          }
          return { ...fn, raw, ast: null, mode, paramX: null, paramY: null, inequalityOp: undefined };
        }
        if (mode === 'polar') {
          const expr = raw.replace(/^r\s*=\s*/i, '');
          try {
            const ast = parse(expr);
            return { ...fn, raw, ast, mode, paramX: null, paramY: null, inequalityOp: undefined };
          } catch {
            return { ...fn, raw, ast: null, mode, paramX: null, paramY: null, inequalityOp: undefined };
          }
        }
        try {
          const ast = parse(raw);
          return { ...fn, raw, ast, mode: 'explicit', paramX: null, paramY: null, inequalityOp: undefined };
        } catch {
          return { ...fn, raw, ast: null, mode: 'explicit', paramX: null, paramY: null, inequalityOp: undefined };
        }
      }),
    );
    this.requestRender();
  }

  toggleVisibility(index: number): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => (i === index ? { ...fn, visible: !fn.visible } : fn)),
    );
    this.requestRender();
  }

  cycleMode(index: number): void {
    const modes: CurveMode[] = ['explicit', 'parametric', 'polar', 'implicit'];
    this.functions.update((fns) =>
      fns.map((fn, i) => {
        if (i !== index) return fn;
        const currentIdx = modes.indexOf(fn.mode);
        const nextMode = modes[(currentIdx + 1) % modes.length];
        return { ...fn, mode: nextMode, ast: null, paramX: null, paramY: null, inequalityOp: undefined };
      }),
    );
    const fn = this.functions()[index];
    if (fn) this.updateExpression(index, fn.raw);
  }

  updateParamRange(index: number, field: 'tMin' | 'tMax' | 'thetaMin' | 'thetaMax', value: string): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => (i === index ? { ...fn, [field]: value } : fn)),
    );
    this.requestRender();
  }

  private detectMode(raw: string): CurveMode {
    const trimmed = raw.trim();
    if (/^r\s*=/i.test(trimmed)) return 'polar';
    if (/[<>]=?/.test(trimmed)) return 'implicit';
    if (/^[^a-zA-Z]*[xy]\s*[,)].*t/.test(trimmed) || /t\s*[,)].*[xy]/.test(trimmed))
      return 'parametric';
    if (/[=]/.test(trimmed) && !/^[yY]\s*=/.test(trimmed)) return 'implicit';
    return 'explicit';
  }

  updateIntegralA(value: string): void {
    const v = this.parseLimit(value, 'integralA');
    if (v !== null) {
      this.activeIntegral.update((i) => (i ? { ...i, a: v } : null));
      this.requestRender();
    }
  }

  updateIntegralB(value: string): void {
    const v = this.parseLimit(value, 'integralB');
    if (v !== null) {
      this.activeIntegral.update((i) => (i ? { ...i, b: v } : null));
      this.requestRender();
    }
  }

  activateIntegral(): void {
    const current = this.activeIntegral();
    if (current) {
      this.activeIntegral.set(null);
    } else {
      this.activeSolid.set(null);
      this.activeMultiArea.set(null);
      this.show3DSolid.set(false);
      this.activeIntegral.set({ fnIndex: 0, a: -2, b: 2 });
    }
    this.requestRender();
  }

  activateSolid(): void {
    const current = this.activeSolid();
    if (current) {
      this.activeSolid.set(null);
      this.show3DSolid.set(false);
    } else {
      this.activeIntegral.set(null);
      this.activeMultiArea.set(null);
      const visibles = this.functions()
        .map((f, i) => ({ f, i }))
        .filter((x) => x.f.visible && (x.f.ast || x.f.mode === 'implicit'));
      const indices = visibles.slice(0, Math.min(2, visibles.length)).map((x) => x.i);

      const evalFns = indices
        .map((i) => this.functions()[i])
        .filter(
          (e): e is MathExpression & { ast: NonNullable<MathExpression['ast']> } =>
            !!e?.ast && e.visible && this.canUseWithTools(e),
        )
        .map((e) => (x: number) => evalExpression(e.ast!, x));

      let a = this.viewport.xMin;
      let b = this.viewport.xMax;

      if (evalFns.length === 1) {
        const crossings = findAxisCrossings(evalFns[0], a, b, 0);
        if (crossings.length >= 2) {
          const sorted = [...crossings].sort((x, y) => Math.abs(x) - Math.abs(y));
          a = Math.min(sorted[0], sorted[1]);
          b = Math.max(sorted[0], sorted[1]);
        }
      } else if (evalFns.length >= 2) {
        const intersections = findIntersections(evalFns, a, b);
        if (intersections.length >= 2) {
          const sorted = [...intersections].sort((p, q) => Math.abs(p.x) - Math.abs(q.x));
          a = Math.min(sorted[0].x, sorted[1].x);
          b = Math.max(sorted[0].x, sorted[1].x);
        }
      }

      this.activeSolid.set({
        functionIndices: indices.length > 0 ? indices : [0],
        a,
        b,
        axis: { type: 'x', value: 0 },
        overlapMode: 'pairwise',
      });
    }
    this.requestRender();
  }

  toggleSolidFunction(index: number): void {
    this.activeSolid.update((cfg) => {
      if (!cfg) return null;
      const has = cfg.functionIndices.includes(index);
      if (has) {
        const newIndices = cfg.functionIndices.filter((i) => i !== index);
        return newIndices.length >= 1 ? { ...cfg, functionIndices: newIndices } : null;
      }
      return { ...cfg, functionIndices: [...cfg.functionIndices, index].sort() };
    });
    this.requestRender();
  }

  updateSolidA(value: string): void {
    const v = this.parseLimit(value, 'solidA');
    if (v !== null) {
      this.activeSolid.update((s) => (s ? { ...s, a: v } : null));
      this.requestRender();
    }
  }

  updateSolidB(value: string): void {
    const v = this.parseLimit(value, 'solidB');
    if (v !== null) {
      this.activeSolid.update((s) => (s ? { ...s, b: v } : null));
      this.requestRender();
    }
  }

  updateSolidAxisType(value: string): void {
    const type = value as RotationAxis['type'];
    this.activeSolid.update((s) => {
      if (!s) return null;
      return { ...s, axis: { type, value: s.axis.value } };
    });
    this.requestRender();
  }

  updateSolidAxisValue(value: string): void {
    const v = parseFloat(value);
    if (!isNaN(v)) {
      this.activeSolid.update((s) => {
        if (!s) return null;
        return { ...s, axis: { ...s.axis, value: v } };
      });
      this.requestRender();
    }
  }

  updateSolidOverlapMode(checked: boolean): void {
    this.activeSolid.update((s) =>
      s ? { ...s, overlapMode: checked ? 'all' : 'pairwise' } : null,
    );
    this.requestRender();
  }

  activateMultiArea(): void {
    const current = this.activeMultiArea();
    if (current) {
      this.activeMultiArea.set(null);
    } else {
      this.activeIntegral.set(null);
      this.activeSolid.set(null);
      this.show3DSolid.set(false);
      const indices =
        this.functions().length >= 2
          ? [0, 1]
          : this.functions().length === 1
            ? [0]
            : [];
      this.activeMultiArea.set({
        functionIndices: indices,
        a: -2,
        b: 2,
        autoDetectIntersections: true,
        overlapMode: 'pairwise',
      });
    }
    this.requestRender();
  }

  toggleMultiAreaFunction(index: number): void {
    this.activeMultiArea.update((cfg) => {
      if (!cfg) return null;
      const has = cfg.functionIndices.includes(index);
      if (has) {
        return { ...cfg, functionIndices: cfg.functionIndices.filter((i) => i !== index) };
      }
      return { ...cfg, functionIndices: [...cfg.functionIndices, index].sort() };
    });
    this.requestRender();
  }

  updateMultiAreaA(value: string): void {
    const v = this.parseLimit(value, 'multiA');
    if (v !== null) {
      this.activeMultiArea.update((cfg) => (cfg ? { ...cfg, a: v } : null));
      this.requestRender();
    }
  }

  updateMultiAreaB(value: string): void {
    const v = this.parseLimit(value, 'multiB');
    if (v !== null) {
      this.activeMultiArea.update((cfg) => (cfg ? { ...cfg, b: v } : null));
      this.requestRender();
    }
  }

  updateMultiAreaOverlapMode(checked: boolean): void {
    this.activeMultiArea.update((cfg) =>
      cfg ? { ...cfg, overlapMode: checked ? 'all' : 'pairwise' } : null,
    );
    this.requestRender();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.mousePos.set({ x, y });

    if (this.isDragging()) {
      const last = this.lastDrag();
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        this.viewport.pan(dx, dy, canvas.width, canvas.height);
      }
      this.lastDrag.set({ x, y });
    }

    this.requestRender();
  }

  onCanvasMouseLeave(): void {
    this.mousePos.set(null);
    this.requestRender();
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.viewport.zoom(factor, x, y, canvas.width, canvas.height);
    this.requestRender();
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.isDragging.set(true);
    this.lastDrag.set(null);
  }

  onCanvasMouseUp(): void {
    this.isDragging.set(false);
    this.lastDrag.set(null);
  }

  onCanvasKeyDown(event: KeyboardEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const PAN_STEP = 30;
    switch (event.key) {
      case '+':
      case '=':
        this.viewport.zoom(1.15, canvas.width / 2, canvas.height / 2, canvas.width, canvas.height);
        break;
      case '-':
      case '_':
        this.viewport.zoom(
          1 / 1.15,
          canvas.width / 2,
          canvas.height / 2,
          canvas.width,
          canvas.height,
        );
        break;
      case 'ArrowLeft':
        this.viewport.pan(PAN_STEP, 0, canvas.width, canvas.height);
        break;
      case 'ArrowRight':
        this.viewport.pan(-PAN_STEP, 0, canvas.width, canvas.height);
        break;
      case 'ArrowUp':
        this.viewport.pan(0, PAN_STEP, canvas.width, canvas.height);
        break;
      case 'ArrowDown':
        this.viewport.pan(0, -PAN_STEP, canvas.width, canvas.height);
        break;
      case 'r':
      case 'R':
        this.resetView();
        return;
      default:
        return;
    }
    event.preventDefault();
    this.requestRender();
  }

  resetView(): void {
    this.viewport.reset();
    this.render();
  }

  zoomIn(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.viewport.zoom(1.3, canvas.width / 2, canvas.height / 2, canvas.width, canvas.height);
    this.requestRender();
  }

  zoomOut(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.viewport.zoom(1 / 1.3, canvas.width / 2, canvas.height / 2, canvas.width, canvas.height);
    this.requestRender();
  }

  toggleGrid(): void {
    this.showGrid.update((v) => !v);
    this.requestRender();
  }

  toggleAngleUnit(): void {
    this.angleUnit.update((u) => (u === 'deg' ? 'rad' : 'deg'));
  }

  canUseWithTools(fn: MathExpression): boolean {
    if (!fn.visible) return false;
    if (fn.mode === 'explicit') return !!fn.ast;
    if (fn.mode === 'implicit') {
      return !!fn.ast && solveConicForY(fn.ast) !== null;
    }
    if (fn.mode === 'parametric') return !!(fn.paramX && fn.paramY);
    if (fn.mode === 'polar') return !!fn.ast;
    return false;
  }

  toggleKeyboard(): void {
    this.showKeyboard.update((v) => !v);
  }

  onInputFocus(index: number): void {
    this.focusedInputIndex.set(index);
  }

  onInputBlur(): void {
    if (this.blurTimerId !== null) clearTimeout(this.blurTimerId);
    this.blurTimerId = setTimeout(() => this.focusedInputIndex.set(null), 100);
  }

  onDragStart(index: number, event: DragEvent): void {
    this.dragIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  onDragOver(index: number, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(targetIndex: number, event: DragEvent): void {
    event.preventDefault();
    const sourceIndex = this.dragIndex();
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    this.functions.update((fns) => {
      const updated = [...fns];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });

    if (this.activeSolid()) {
      this.activeSolid.update((sol) => {
        if (!sol) return null;
        const newIndices = sol.functionIndices.map((i) => {
          if (i === sourceIndex) return targetIndex;
          if (sourceIndex < targetIndex && i > sourceIndex && i <= targetIndex) return i - 1;
          if (sourceIndex > targetIndex && i >= targetIndex && i < sourceIndex) return i + 1;
          return i;
        });
        return { ...sol, functionIndices: newIndices };
      });
    }

    if (this.activeIntegral()) {
      this.activeIntegral.update((intg) => {
        if (!intg) return null;
        let newIdx = intg.fnIndex;
        if (intg.fnIndex === sourceIndex) newIdx = targetIndex;
        else if (sourceIndex < targetIndex && intg.fnIndex > sourceIndex && intg.fnIndex <= targetIndex) newIdx = intg.fnIndex - 1;
        else if (sourceIndex > targetIndex && intg.fnIndex >= targetIndex && intg.fnIndex < sourceIndex) newIdx = intg.fnIndex + 1;
        return { ...intg, fnIndex: newIdx };
      });
    }

    this.dragIndex.set(null);
    this.requestRender();
  }

  onDragEnd(): void {
    this.dragIndex.set(null);
  }

  onHelpClose(): void {
    this.showHelp.set(false);
    this.helpBtn()?.nativeElement?.focus();
  }

  addConicToGraph(expression: string): void {
    if (this.functions().length >= 5) return;
    const idx = this.functions().length;
    this.functions.update((fns) => [
      ...fns,
      {
        raw: expression,
        ast: null,
        color: FUNCTION_COLORS[idx % FUNCTION_COLORS.length],
        visible: true,
        mode: 'implicit',
      },
    ]);
    this.updateExpression(idx, expression);
    this.showConicAssistant.set(false);
  }

  onKeyPress(symbol: string): void {
    const idx = this.focusedInputIndex();
    if (idx === null) return;
    const inputs = this.fnInputs();
    const inputEl = inputs?.[idx]?.nativeElement;
    if (!inputEl) return;

    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? start;
    const current = this.functions()[idx].raw;
    const newValue = current.slice(0, start) + symbol + current.slice(end);
    this.updateExpression(idx, newValue);

    const rafId = requestAnimationFrame(() => {
      inputEl.selectionStart = inputEl.selectionEnd = start + symbol.length;
      inputEl.focus();
    });
    this.pendingRafIds.push(rafId);
  }

  onKeyAction(action: 'backspace' | 'left' | 'right' | 'clear'): void {
    const idx = this.focusedInputIndex();
    if (idx === null) return;
    const inputs = this.fnInputs();
    const inputEl = inputs?.[idx]?.nativeElement;
    if (!inputEl) return;

    const current = this.functions()[idx].raw;

    if (action === 'clear') {
      this.updateExpression(idx, '');
      const rafId = requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = 0;
        inputEl.focus();
      });
      this.pendingRafIds.push(rafId);
      return;
    }

    const start = inputEl.selectionStart ?? inputEl.value.length;

    if (action === 'backspace') {
      if (start > 0) {
        const newValue = current.slice(0, start - 1) + current.slice(start);
        this.updateExpression(idx, newValue);
        const rafId = requestAnimationFrame(() => {
          inputEl.selectionStart = inputEl.selectionEnd = start - 1;
          inputEl.focus();
        });
        this.pendingRafIds.push(rafId);
      }
    } else if (action === 'left') {
      const rafId = requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = Math.max(0, start - 1);
        inputEl.focus();
      });
      this.pendingRafIds.push(rafId);
    } else if (action === 'right') {
      const rafId = requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = Math.min(current.length, start + 1);
        inputEl.focus();
      });
      this.pendingRafIds.push(rafId);
    }
  }

  private parseLimit(value: string, key: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      this.limitErrors.update((e) => ({ ...e, [key]: false }));
      return null;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      this.limitErrors.update((e) => ({ ...e, [key]: false }));
      return num;
    }
    try {
      const result = evalConstantExpression(trimmed);
      this.limitErrors.update((e) => ({ ...e, [key]: false }));
      return result;
    } catch {
      this.limitErrors.update((e) => ({ ...e, [key]: true }));
      return null;
    }
  }

  private evalRange(raw: string | undefined, defaultVal: number): number {
    if (!raw) return defaultVal;
    const trimmed = raw.trim();
    if (!trimmed) return defaultVal;
    const num = parseFloat(trimmed);
    if (!isNaN(num)) return num;
    try {
      return evalConstantExpression(trimmed);
    } catch {
      return defaultVal;
    }
  }

  private parseAll(): void {
    this.functions.update((fns) =>
      fns.map((fn) => {
        if (!fn.raw || fn.ast) return fn;
        try {
          return { ...fn, ast: parse(fn.raw) };
        } catch {
          return fn;
        }
      }),
    );
  }

  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    const w = canvas.width;
    const h = canvas.height;
    const au = this.angleUnit();

    if (this.showGrid()) {
      drawGrid(ctx, this.viewport, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0d0d15';
      ctx.fillRect(0, 0, w, h);
    }

    for (const fn of this.functions()) {
      if (!fn.visible || !fn.raw) continue;
      if (fn.mode === 'implicit') {
        if (fn.inequalityOp && fn.ast) {
          const isExplicit = /^\s*y\s*(>=|<=|>|<)/i.test(fn.raw);
          if (isExplicit) {
            const evalFn = (x: number) => evalExpression(fn.ast!, x, undefined, au);
            drawInequality(ctx, this.viewport, evalFn, fn.inequalityOp, fn.color, w, h);
          } else {
            const evalFn = (x: number, y: number) => evalExpression(fn.ast!, x, y, au);
            drawImplicitInequality(ctx, this.viewport, evalFn, fn.inequalityOp, fn.color, w, h);
          }
        } else {
          if (!fn.raw.includes('=')) continue;
          const parts = fn.raw.split('=');
          if (parts.length !== 2) continue;
          const lhs = parts[0].trim();
          const rhs = parts[1].trim();
          const exprStr = `(${lhs})-(${rhs})`;
          try {
            const expr = parse(exprStr);
            const evalFn = (x: number, y: number) => evalExpression(expr, x, y, au);
            drawImplicitCurve(ctx, this.viewport, evalFn, fn.color, w, h);
          } catch {
            /* skip */
          }
        }
      } else if (fn.mode === 'parametric') {
        if (!fn.paramX || !fn.paramY) continue;
        const evalX = (t: number) => evalExpression(fn.paramX!, t, undefined, au);
        const evalY = (t: number) => evalExpression(fn.paramY!, t, undefined, au);
        const tMin = this.evalRange(fn.tMin, 0);
        const tMax = this.evalRange(fn.tMax, 2 * Math.PI);
        drawParametric(ctx, this.viewport, evalX, evalY, tMin, tMax, fn.color, w, h);
      } else if (fn.mode === 'polar') {
        if (!fn.ast) continue;
        const evalR = (theta: number) => evalExpression(fn.ast!, theta, undefined, au);
        const thetaMin = this.evalRange(fn.thetaMin, 0);
        const thetaMax = this.evalRange(fn.thetaMax, 2 * Math.PI);
        drawPolar(ctx, this.viewport, evalR, thetaMin, thetaMax, fn.color, w, h);
      } else {
        if (!fn.ast) continue;
        const evalFn = (x: number) => evalExpression(fn.ast!, x, undefined, au);
        drawFunction(ctx, this.viewport, evalFn, fn.color, w, h);
        const asymptotes = detectAsymptotes(evalFn, this.viewport.xMin, this.viewport.xMax);
        for (const a of asymptotes) {
          drawAsymptote(ctx, this.viewport, a, w, h);
        }
      }
    }

    const intg = this.activeIntegral();
    if (intg) {
      const expr = this.functions()[intg.fnIndex];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x, undefined, au);
        drawIntegralArea(ctx, this.viewport, fn, intg.a, intg.b, expr.color, w, h);
      }
    }

    const mArea = this.activeMultiArea();
    if (mArea && mArea.functionIndices.length >= 2) {
      const fns = mArea.functionIndices
        .map((i) => this.functions()[i])
        .filter(
          (e): e is MathExpression & { ast: NonNullable<MathExpression['ast']> } =>
            !!e?.ast && e.visible,
        );
      if (fns.length >= 2) {
        const evalFns = fns.map((f) => (x: number) => evalExpression(f.ast, x, undefined, au));
        const intersections = findIntersections(evalFns, mArea.a, mArea.b);
        const regions = computeAreaRegions(evalFns, intersections, mArea.a, mArea.b);

        for (const region of regions) {
          const topFn = evalFns[region.topFunctionIndex];
          const bottomFn = evalFns[region.bottomFunctionIndex];
          const topColor = fns[region.topFunctionIndex].color;
          drawAreaBetween(ctx, this.viewport, topFn, bottomFn, region.a, region.b, topColor, w, h);
        }

        for (const pt of intersections) {
          const [sx, sy] = this.viewport.worldToScreen(pt.x, pt.y, w, h);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff40';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    } else if (mArea && mArea.functionIndices.length === 1) {
      const expr = this.functions()[mArea.functionIndices[0]];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x);
        drawIntegralArea(ctx, this.viewport, fn, mArea.a, mArea.b, expr.color, w, h);
      }
    }

    const sol = this.activeSolid();
    if (sol) {
      const evalFns = this.solidEvalFns();
      const regions = this.solidRegions();
      if (evalFns.length === 1 && regions.length > 0) {
        const expr = this.functions()[sol.functionIndices[0]];
        if (expr?.ast && expr.visible) {
          drawSolidCrossSectionSingle(
            ctx,
            this.viewport,
            evalFns[0],
            sol.a,
            sol.b,
            sol.axis,
            w,
            h,
            expr.color,
          );
        }
      } else if (evalFns.length >= 2 && regions.length > 0) {
        drawSolidCrossSectionMulti(
          ctx,
          this.viewport,
          evalFns,
          this.solidFnColors(),
          regions,
          sol.axis,
          w,
          h,
        );
      }
    }

    const mouse = this.mousePos();
    if (mouse && !this.isDragging()) {
      const intgFn = this.activeIntegral();
      let activeFn: ((x: number) => number) | null = null;
      if (intgFn) {
        const expr = this.functions()[intgFn.fnIndex];
        if (expr?.ast && expr.visible) {
          activeFn = (x: number) => evalExpression(expr.ast!, x, undefined, au);
        }
      }
      drawCrosshair(ctx, this.viewport, mouse.x, mouse.y, activeFn, '#666680', w, h);
    }
  }
}
