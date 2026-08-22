import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  ElementRef,
  viewChild,
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
import { drawFunction, drawIntegralArea, drawCrosshair, drawAreaBetween } from './canvas/graph-renderer';
import { drawSolidCrossSection } from './canvas/solid-renderer';
import { parse } from './engine/parser';
import { evalExpression } from './engine/evaluator';
import { integrate } from './engine/integrator';
import { solidVolume, solidSurfaceArea, areaBetweenCurves } from './engine/calculus';
import { FUNCTION_COLORS } from './utils/color';
import type { MathExpression, IntegralResult, RotationAxis, SolidConfig, BoundedAreaConfig } from './models/calculator.models';

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
  imports: [RouterLink],
  templateUrl: './graphing-calculator.component.html',
  styleUrls: ['./graphing-calculator.component.css', './sidebar.css', './results.css'],
})
export class GraphingCalculatorComponent implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);

  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('graphCanvas');

  functions = signal<MathExpression[]>([
    { raw: 'sin(x)', ast: null, color: FUNCTION_COLORS[0], visible: true },
  ]);

  activeIntegral = signal<{ fnIndex: number; a: number; b: number } | null>(null);
  activeSolid = signal<SolidConfig | null>(null);
  activeBoundedArea = signal<BoundedAreaConfig | null>(null);
  solidRotation = signal(45);
  angleUnit = signal<'deg' | 'rad'>('deg');

  viewport = new Viewport();
  mousePos = signal<{ x: number; y: number } | null>(null);
  isDragging = signal(false);
  lastDrag = signal<{ x: number; y: number } | null>(null);

  private resizeObserver: ResizeObserver | null = null;
  private renderRequested = false;

  private requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    requestAnimationFrame(() => {
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
        const axisLabel = sol.axis.type === 'x' && sol.axis.value === 0
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
  }

  addFunction(): void {
    if (this.functions().length >= 5) return;
    const idx = this.functions().length;
    this.functions.update((fns) => [
      ...fns,
      { raw: '', ast: null, color: FUNCTION_COLORS[idx % FUNCTION_COLORS.length], visible: true },
    ]);
  }

  removeFunction(index: number): void {
    this.functions.update((fns) => fns.filter((_, i) => i !== index));
    this.requestRender();
  }

  updateExpression(index: number, raw: string): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => {
        if (i !== index) return fn;
        try {
          const ast = parse(raw);
          return { ...fn, raw, ast };
        } catch {
          return { ...fn, raw, ast: null };
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

  updateIntegralA(value: string): void {
    const v = parseFloat(value);
    if (!isNaN(v)) {
      this.activeIntegral.update((i) => (i ? { ...i, a: v } : null));
      this.requestRender();
    }
  }

  updateIntegralB(value: string): void {
    const v = parseFloat(value);
    if (!isNaN(v)) {
      this.activeIntegral.update((i) => (i ? { ...i, b: v } : null));
      this.requestRender();
    }
  }

  updateSolidA(value: string): void {
    const v = parseFloat(value);
    if (!isNaN(v)) {
      this.activeSolid.update((s) => (s ? { ...s, a: v } : null));
      this.requestRender();
    }
  }

  updateSolidB(value: string): void {
    const v = parseFloat(value);
    if (!isNaN(v)) {
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
    const v = parseFloat(value);
    if (!isNaN(v)) {
      this.activeBoundedArea.update((b) => (b ? { ...b, a: v } : null));
      this.requestRender();
    }
  }

  updateBoundedB(value: string): void {
    const v = parseFloat(value);
    if (!isNaN(v)) {
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
        this.viewport.zoom(1 / 1.15, canvas.width / 2, canvas.height / 2, canvas.width, canvas.height);
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

  toggleAngleUnit(): void {
    this.angleUnit.update((u) => (u === 'deg' ? 'rad' : 'deg'));
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

    drawGrid(ctx, this.viewport, w, h);

    for (const fn of this.functions()) {
      if (!fn.ast || !fn.visible || !fn.raw) continue;
      const evalFn = (x: number) => evalExpression(fn.ast!, x);
      drawFunction(ctx, this.viewport, evalFn, fn.color, w, h);
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

    const sol = this.activeSolid();
    if (sol) {
      const expr = this.functions()[sol.fnIndex];
      if (expr?.ast && expr.visible) {
        const fn = (x: number) => evalExpression(expr.ast!, x);
        drawSolidCrossSection(ctx, this.viewport, fn, sol.a, sol.b, sol.axis, w, h);
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
