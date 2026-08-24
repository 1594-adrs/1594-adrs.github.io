import {
  Component,
  ChangeDetectionStrategy,
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
} from './canvas/graph-renderer';
import { drawImplicitCurve } from './canvas/implicit-renderer';
import { drawSolidCrossSection } from './canvas/solid-renderer';
import { parse } from './engine/parser';
import { evalExpression, evalConstantExpression } from './engine/evaluator';
import { integrate } from './engine/integrator';
import { solidVolume, solidSurfaceArea, areaBetweenCurves } from './engine/calculus';
import { findIntersections } from './engine/intersection-finder';
import { computeAreaRegions } from './engine/area-splitter';
import { FUNCTION_COLORS } from './utils/color';
import { OnscreenKeyboardComponent } from './keyboard/onscreen-keyboard.component';
import type {
  MathExpression,
  IntegralResult,
  RotationAxis,
  SolidConfig,
  BoundedAreaConfig,
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
  imports: [RouterLink, OnscreenKeyboardComponent, Solid3DComponent, HelpModalComponent],
  templateUrl: './graphing-calculator.component.html',
  styleUrls: ['./graphing-calculator.component.css', './sidebar.css', './results.css'],
})
export class GraphingCalculatorComponent implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);

  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('graphCanvas');
  fnInputs = viewChildren<ElementRef<HTMLInputElement>>('fnInput');

  functions = signal<MathExpression[]>([
    { raw: 'sin(x)', ast: null, color: FUNCTION_COLORS[0], visible: true, mode: 'explicit' },
  ]);

  activeIntegral = signal<{ fnIndex: number; a: number; b: number } | null>(null);
  activeSolid = signal<SolidConfig | null>(null);
  activeBoundedArea = signal<BoundedAreaConfig | null>(null);
  activeMultiArea = signal<MultiFunctionAreaConfig | null>(null);
  solidRotation = signal(45);
  angleUnit = signal<'deg' | 'rad'>('deg');
  limitErrors = signal<Record<string, boolean>>({});
  showKeyboard = signal(false);
  show3DSolid = signal(false);
  showHelp = signal(false);
  showCanvasControls = signal(false);
  showGrid = signal(true);
  focusedInputIndex = signal<number | null>(null);

  solidFunction = computed<((x: number) => number) | null>(() => {
    const sol = this.activeSolid();
    if (!sol) return null;
    const expr = this.functions()[sol.fnIndex];
    if (!expr?.ast || !expr.visible || expr.mode !== 'explicit') return null;
    return (x: number) => evalExpression(expr.ast!, x);
  });

  solidColor = computed(() => {
    const sol = this.activeSolid();
    if (!sol) return '#00ff88';
    return this.functions()[sol.fnIndex]?.color ?? '#00ff88';
  });

  viewport = new Viewport();
  mousePos = signal<{ x: number; y: number } | null>(null);
  isDragging = signal(false);
  lastDrag = signal<{ x: number; y: number } | null>(null);

  private resizeObserver: ResizeObserver | null = null;
  private renderRequested = false;
  private animFrameId = 0;

  private requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    this.animFrameId = requestAnimationFrame(() => {
      this.renderRequested = false;
      this.render();
    });
  }

  results = computed<IntegralResult[]>(() => {
    const res: IntegralResult[] = [];
    const intg = this.activeIntegral();
    if (intg) {
      const expr = this.functions()[intg.fnIndex];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x);
        const value = integrate(fn, intg.a, intg.b);
        res.push({ label: `∫ ${expr.raw} dx`, value: formatValue(value) });
      }
    }
    const sol = this.activeSolid();
    if (sol) {
      const expr = this.functions()[sol.fnIndex];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x);
        const vol = solidVolume(fn, sol.a, sol.b, sol.axis);
        const sa = solidSurfaceArea(fn, sol.a, sol.b, sol.axis);
        const axisLabel =
          sol.axis.type === 'x' && sol.axis.value === 0
            ? 'y = 0'
            : sol.axis.type === 'y' && sol.axis.value === 0
              ? 'x = 0'
              : sol.axis.type === 'y'
                ? `x = ${sol.axis.value}`
                : `y = ${sol.axis.value}`;
        res.push({ label: `V [${axisLabel}]`, value: formatValue(vol) });
        res.push({ label: `S [${axisLabel}]`, value: formatValue(sa) });
      }
    }
    const bnd = this.activeBoundedArea();
    if (bnd) {
      const exprU = this.functions()[bnd.fnIndexUpper];
      const exprL = this.functions()[bnd.fnIndexLower];
      if (exprU?.ast && exprU.visible && exprL?.ast && exprL.visible) {
        const fU = (x: number) => evalExpression(exprU.ast!, x);
        const fL = (x: number) => evalExpression(exprL.ast!, x);
        const value = areaBetweenCurves(fU, fL, bnd.a, bnd.b);
        res.push({ label: `A [${exprU.raw} , ${exprL.raw}]`, value: formatValue(value) });
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
        const evalFns = fns.map((f) => (x: number) => evalExpression(f.ast, x));
        const regions = computeAreaRegions(
          evalFns,
          findIntersections(evalFns, mArea.a, mArea.b),
          mArea.a,
          mArea.b,
        );
        let total = 0;
        for (const r of regions) total += r.area;
        const labels = fns.map((f) => f.raw).join(', ');
        res.push({ label: `A [${labels}]`, value: formatValue(total) });
      }
    }

    return res;
  });

  ngAfterViewInit(): void {
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
    if (this.isBrowser) cancelAnimationFrame(this.animFrameId);
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
      this.activeBoundedArea.set(null);
      this.activeMultiArea.set(null);
    }
    this.requestRender();
  }

  updateExpression(index: number, raw: string): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => {
        if (i !== index) return fn;
        const mode = this.detectMode(raw);
        if (mode === 'implicit') {
          try {
            const ast = parse(raw);
            return { ...fn, raw, ast, mode, paramX: null, paramY: null };
          } catch {
            return { ...fn, raw, ast: null, mode, paramX: null, paramY: null };
          }
        }
        if (mode === 'parametric') {
          const parts = raw.split(',');
          if (parts.length === 2) {
            try {
              const paramX = parse(parts[0].trim());
              const paramY = parse(parts[1].trim());
              return { ...fn, raw, ast: null, mode, paramX, paramY };
            } catch {
              return { ...fn, raw, ast: null, mode, paramX: null, paramY: null };
            }
          }
          return { ...fn, raw, ast: null, mode, paramX: null, paramY: null };
        }
        if (mode === 'polar') {
          const expr = raw.replace(/^r\s*=\s*/i, '');
          try {
            const ast = parse(expr);
            return { ...fn, raw, ast, mode, paramX: null, paramY: null };
          } catch {
            return { ...fn, raw, ast: null, mode, paramX: null, paramY: null };
          }
        }
        try {
          const ast = parse(raw);
          return { ...fn, raw, ast, mode: 'explicit', paramX: null, paramY: null };
        } catch {
          return { ...fn, raw, ast: null, mode: 'explicit', paramX: null, paramY: null };
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
        return { ...fn, mode: nextMode, ast: null, paramX: null, paramY: null };
      }),
    );
    const fn = this.functions()[index];
    if (fn) this.updateExpression(index, fn.raw);
  }

  private detectMode(raw: string): CurveMode {
    const trimmed = raw.trim();
    if (/^[^=]+=/.test(trimmed) && !/^r\s*=/i.test(trimmed)) return 'implicit';
    if (/^r\s*=/i.test(trimmed)) return 'polar';
    if (/^[^a-zA-Z]*[xy]\s*[,)].*t/.test(trimmed) || /t\s*[,)].*[xy]/.test(trimmed))
      return 'parametric';
    return 'explicit';
  }

  activateIntegral(): void {
    const current = this.activeIntegral();
    if (current) {
      this.activeIntegral.set(null);
    } else {
      this.activeIntegral.set({ fnIndex: 0, a: -2, b: 2 });
    }
    this.requestRender();
  }

  activateSolid(): void {
    const current = this.activeSolid();
    if (current) {
      this.activeSolid.set(null);
    } else {
      this.activeSolid.set({ fnIndex: 0, a: 0, b: 3, axis: { type: 'x', value: 0 } });
    }
    this.requestRender();
  }

  activateBoundedArea(): void {
    const current = this.activeBoundedArea();
    if (current) {
      this.activeBoundedArea.set(null);
    } else {
      const fns = this.functions();
      this.activeBoundedArea.set({
        fnIndexUpper: 0,
        fnIndexLower: Math.min(1, fns.length - 1),
        a: -2,
        b: 2,
      });
    }
    this.requestRender();
  }

  activateMultiArea(): void {
    const current = this.activeMultiArea();
    if (current) {
      this.activeMultiArea.set(null);
    } else {
      this.activeMultiArea.set({
        functionIndices: [0, Math.min(1, this.functions().length - 1)],
        a: -2,
        b: 2,
        autoDetectIntersections: true,
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

  updateBoundedUpper(value: string): void {
    const v = parseInt(value, 10);
    if (!isNaN(v) && v >= 0 && v < this.functions().length) {
      this.activeBoundedArea.update((b) => (b ? { ...b, fnIndexUpper: v } : null));
      this.requestRender();
    }
  }

  updateBoundedLower(value: string): void {
    const v = parseInt(value, 10);
    if (!isNaN(v) && v >= 0 && v < this.functions().length) {
      this.activeBoundedArea.update((b) => (b ? { ...b, fnIndexLower: v } : null));
      this.requestRender();
    }
  }

  updateBoundedA(value: string): void {
    const v = this.parseLimit(value, 'boundedA');
    if (v !== null) {
      this.activeBoundedArea.update((b) => (b ? { ...b, a: v } : null));
      this.requestRender();
    }
  }

  updateBoundedB(value: string): void {
    const v = this.parseLimit(value, 'boundedB');
    if (v !== null) {
      this.activeBoundedArea.update((b) => (b ? { ...b, b: v } : null));
      this.requestRender();
    }
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

  hasMultipleFunctions = computed(() => this.functions().length >= 2);

  toggleAngleUnit(): void {
    this.angleUnit.update((u) => (u === 'deg' ? 'rad' : 'deg'));
  }

  toggleKeyboard(): void {
    this.showKeyboard.update((v) => !v);
  }

  onInputFocus(index: number): void {
    this.focusedInputIndex.set(index);
  }

  onInputBlur(): void {
    setTimeout(() => this.focusedInputIndex.set(null), 100);
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

    requestAnimationFrame(() => {
      inputEl.selectionStart = inputEl.selectionEnd = start + symbol.length;
      inputEl.focus();
    });
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
      requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = 0;
        inputEl.focus();
      });
      return;
    }

    const start = inputEl.selectionStart ?? inputEl.value.length;

    if (action === 'backspace') {
      if (start > 0) {
        const newValue = current.slice(0, start - 1) + current.slice(start);
        this.updateExpression(idx, newValue);
        requestAnimationFrame(() => {
          inputEl.selectionStart = inputEl.selectionEnd = start - 1;
          inputEl.focus();
        });
      }
    } else if (action === 'left') {
      requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = Math.max(0, start - 1);
        inputEl.focus();
      });
    } else if (action === 'right') {
      requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = Math.min(current.length, start + 1);
        inputEl.focus();
      });
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
        if (!fn.raw.includes('=')) continue;
        const parts = fn.raw.split('=');
        if (parts.length !== 2) continue;
        const lhs = parts[0].trim();
        const rhs = parts[1].trim();
        const exprStr = `(${lhs})-(${rhs})`;
        try {
          const expr = parse(exprStr);
          const evalFn = (x: number, y: number) => evalExpression(expr, x, y);
          drawImplicitCurve(ctx, this.viewport, evalFn, fn.color, w, h);
        } catch {
          /* skip */
        }
      } else if (fn.mode === 'parametric') {
        if (!fn.paramX || !fn.paramY) continue;
        const evalX = (t: number) => evalExpression(fn.paramX!, t);
        const evalY = (t: number) => evalExpression(fn.paramY!, t);
        drawParametric(ctx, this.viewport, evalX, evalY, 0, 2 * Math.PI, fn.color, w, h);
      } else if (fn.mode === 'polar') {
        if (!fn.ast) continue;
        const evalR = (theta: number) => evalExpression(fn.ast!, theta);
        drawPolar(ctx, this.viewport, evalR, 0, 2 * Math.PI, fn.color, w, h);
      } else {
        if (!fn.ast) continue;
        const evalFn = (x: number) => evalExpression(fn.ast!, x);
        drawFunction(ctx, this.viewport, evalFn, fn.color, w, h);
      }
    }

    const intg = this.activeIntegral();
    if (intg) {
      const expr = this.functions()[intg.fnIndex];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x);
        drawIntegralArea(ctx, this.viewport, fn, intg.a, intg.b, expr.color, w, h);
      }
    }

    const bnd = this.activeBoundedArea();
    if (bnd) {
      const exprU = this.functions()[bnd.fnIndexUpper];
      const exprL = this.functions()[bnd.fnIndexLower];
      if (exprU?.ast && exprU.visible && exprL?.ast && exprL.visible) {
        const fU = (x: number) => evalExpression(exprU.ast!, x);
        const fL = (x: number) => evalExpression(exprL.ast!, x);
        drawAreaBetween(ctx, this.viewport, fU, fL, bnd.a, bnd.b, exprU.color, w, h);
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
        const evalFns = fns.map((f) => (x: number) => evalExpression(f.ast, x));
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
    }

    const sol = this.activeSolid();
    if (sol) {
      const fn = this.solidFunction();
      if (fn) {
        const solXMin = Math.min(sol.a, sol.b);
        const solXMax = Math.max(sol.a, sol.b);
        if (solXMax >= this.viewport.xMin && solXMin <= this.viewport.xMax) {
          const expr = this.functions()[sol.fnIndex];
          drawSolidCrossSection(
            ctx,
            this.viewport,
            fn,
            sol.a,
            sol.b,
            sol.axis,
            w,
            h,
            expr?.color ?? '#00ff88',
          );
        }
      }
    }

    const mouse = this.mousePos();
    if (mouse && !this.isDragging()) {
      const intgFn = this.activeIntegral();
      let activeFn: ((x: number) => number) | null = null;
      if (intgFn) {
        const expr = this.functions()[intgFn.fnIndex];
        if (expr?.ast && expr.visible) {
          activeFn = (x: number) => evalExpression(expr.ast!, x);
        }
      }
      drawCrosshair(ctx, this.viewport, mouse.x, mouse.y, activeFn, '#666680', w, h);
    }
  }
}
