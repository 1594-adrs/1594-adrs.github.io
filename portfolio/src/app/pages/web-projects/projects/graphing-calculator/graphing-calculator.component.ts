import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
  effect,
  afterRenderEffect,
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
  drawExplicitY,
} from './canvas/graph-renderer';
import { drawImplicitCurve } from './canvas/implicit-renderer';
import { drawConicCurve } from './canvas/conic-renderer';
import { solveConicForY } from './engine/conic-solver';
import { detectConic, detectConicDomain } from './engine/conic-detector';
import type { ConicInfo } from './engine/conic-detector';
import { detectAsymptotes } from './engine/asymptote-detector';
import { drawSolidRegion } from './canvas/solid-region-renderer';
import { parse } from './engine/parser';
import type { ExpressionNode } from './engine/parser';
import {
  evalExpression,
  evaluate,
  evalConstantExpression,
  compileExpression,
} from './engine/evaluator';
import { integrateAdaptive } from './engine/quadrature';
import { areaSingle } from './engine/calculus';
import { findIntersections } from './engine/intersection-finder';
import { findAxisCrossings } from './canvas/utils';
import { findNearestCurvePoint } from './canvas/curve-locator';
import type { TraceCurve } from './canvas/curve-locator';
import { drawTracePoint, drawPointOfInterest } from './canvas/trace-renderer';
import { computePointsOfInterest } from './engine/critical-points';
import type { NamedCurve, PointOfInterest } from './engine/critical-points';
import { parseLimitText } from './engine/parse-limit';
import { computeAreaRegions } from './engine/area-splitter';
import { detectCurveMode } from './engine/mode-detector';
import { FUNCTION_COLORS } from './utils/color';
import { OnscreenKeyboardComponent } from './keyboard/onscreen-keyboard.component';
import { MathRendererComponent } from './components/math-renderer/math-renderer.component';
import { ConicAssistantComponent } from './components/conic-assistant/conic-assistant.component';
import { SolidPanelComponent } from './components/solid-panel/solid-panel.component';
import { ValueTable } from './components/value-table/value-table';
import { ColorPicker } from './components/color-picker/color-picker';
import { SolidToolState } from './state/solid-tool.state';
import { GraphInteractionState } from './state/graph-interaction.state';
import { UiLayoutState } from './state/ui-layout.state';
import type { ToolTab, SheetSnap } from './state/ui-layout.state';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { ShortcutsPopover } from './components/shortcuts-popover/shortcuts-popover';
import {
  buildShareHash,
  extractShareFragment,
  parseShareState,
  type ShareState,
} from './state/share-state';
import { formatValue } from './utils/format-value';
import { downloadCanvasAsPng } from './utils/export-png';
import type {
  MathExpression,
  IntegralResult,
  MultiFunctionAreaConfig,
  CurveMode,
} from './models/calculator.models';

/** Screen-px hit radius for snapping the pointer to a curve (trace mode). */
const TRACE_SNAP_PX = 12;
/** Click/tap hit radius for a point of interest; wider on coarse (touch) pointers. */
const POI_HIT_PX_FINE = 12;
const POI_HIT_PX_COARSE = 22;
/** Debounce for recomputing points of interest after a pan/zoom. */
const POI_RECOMPUTE_DELAY_MS = 150;
/** Movement (screen px) beyond which a single-finger touch commits to panning
 *  instead of holding still to trace a curve. */
const TOUCH_PAN_THRESHOLD_PX = 10;

/**
 * Rewrites the evaluator's "Unknown variable: 'foo'" into a display message.
 * When `foo` is immediately followed by `(` in the parsed text, the user
 * likely meant to call an unrecognized function, so the message says so.
 */
function formatExpressionError(message: string, exprText: string): string {
  const match = /^Unknown variable: '([^']+)'$/.exec(message);
  if (!match) return message;
  const name = match[1];
  const followedByParen = new RegExp(`${name}\\s*\\(`).test(exprText);
  return followedByParen ? `Unknown function or variable '${name}'` : `Unknown variable '${name}'`;
}

/** Rounds an auto-detected solid bound to a friendly display precision. */
function roundLimit(v: number): number {
  return Math.round(v * 10000) / 10000;
}

@Component({
  selector: 'app-graphing-calculator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    OnscreenKeyboardComponent,
    Solid3DComponent,
    HelpModalComponent,
    MathRendererComponent,
    ConicAssistantComponent,
    SolidPanelComponent,
    ValueTable,
    ColorPicker,
    IconComponent,
    ShortcutsPopover,
  ],
  providers: [SolidToolState, GraphInteractionState, UiLayoutState],
  templateUrl: './graphing-calculator.component.html',
  styleUrls: [
    './graphing-calculator.component.css',
    './canvas.css',
    './function-list.css',
    './results.css',
  ],
})
export class GraphingCalculatorComponent implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Captured as early as possible (a field initializer runs in the constructor, before
  // ngAfterViewInit and before any later router/hydration activity gets a chance to touch
  // `location.hash`), so a share link survives even if something clears the hash later.
  private pendingShareFragment: string | null = this.isBrowser
    ? extractShareFragment(location.hash)
    : null;
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private titleService = inject(Title);
  solidToolState = inject(SolidToolState);
  interactionState = inject(GraphInteractionState);
  uiLayout = inject(UiLayoutState);

  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('graphCanvas');
  fnInputs = viewChildren<ElementRef<HTMLInputElement>>('fnInput');
  helpBtn = viewChild<ElementRef<HTMLButtonElement>>('helpBtn');
  solid3dRef = viewChild(Solid3DComponent);

  functions = signal<MathExpression[]>([
    {
      raw: 'sin(x)',
      ast: null,
      color: FUNCTION_COLORS[0],
      visible: true,
      mode: 'explicit',
      error: null,
    },
  ]);

  activeIntegral = signal<{ fnIndex: number; a: number; b: number } | null>(null);
  showSolidTool = signal(false);
  activeMultiArea = signal<MultiFunctionAreaConfig | null>(null);
  angleUnit = signal<'deg' | 'rad'>('rad');
  limitErrors = signal<Record<string, boolean>>({});
  showKeyboard = signal(false);
  show3DSolid = signal(false);
  showHelp = signal(false);
  showConicAssistant = signal(false);
  showGrid = signal(true);
  focusedInputIndex = signal<number | null>(null);
  evalPoint = signal<string>('0');
  dragIndex = signal<number | null>(null);
  moveAnnouncement = signal<string>('');
  poiAnnouncement = signal<string>('');
  tableOpenIndex = signal<number | null>(null);
  shareNotice = signal<string>('');
  private shareNoticeTimerId: ReturnType<typeof setTimeout> | null = null;

  /** Accessible description of what's currently on the canvas, for aria-describedby. */
  canvasDescription = computed(() => {
    const parts: string[] = [];
    const descriptions = this.functions()
      .filter((f) => f.visible && f.raw.trim())
      .map((f) => this.describeFunctionForA11y(f));
    parts.push(
      descriptions.length > 0 ? `Graph of ${descriptions.join(', ')}.` : 'No functions plotted.',
    );
    if (this.showSolidTool()) parts.push('Solid of revolution tool active.');
    if (this.activeIntegral()) parts.push('Integral tool active.');
    if (this.activeMultiArea()) parts.push('Area between curves tool active.');
    if (this.poiAnnouncement()) parts.push(this.poiAnnouncement());
    return parts.join(' ');
  });

  private describeFunctionForA11y(f: MathExpression): string {
    switch (f.mode) {
      case 'explicit':
        return `y = ${f.raw}`;
      case 'explicit-y':
        return `x = ${f.raw.replace(/^[xX]\s*=\s*/, '')}`;
      case 'parametric':
        return `parametric curve ${f.raw}`;
      case 'polar':
        return `polar curve ${f.raw}`;
      default:
        return f.raw;
    }
  }

  evalResults = computed(() => {
    const point = parseFloat(this.evalPoint());
    if (isNaN(point)) return [];
    const au = this.angleUnit();
    return this.functions()
      .filter((f) => f.visible && f.ast && f.mode !== 'explicit-y')
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

  /** Color of the solid's first curve, for the 3D view; falls back to the default palette. */
  solidColor = computed(() => this.solidToolState.spec()?.curves[0]?.color ?? FUNCTION_COLORS[0]);

  hasSolidResult = computed(() => {
    const result = this.solidToolState.result();
    return !!result && result.volume !== null;
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
  private poiTimer: ReturnType<typeof setTimeout> | null = null;
  private poiKey: string | null = null;
  private touchAnchor: { x: number; y: number } | null = null;
  private touchPanEngaged = false;

  /** Canvas size in CSS px (logical drawing space — what Viewport/renderers use) and
   *  its bounding rect, cached by `measureCanvas()` (the ResizeObserver callback and
   *  gesture starts) instead of re-measured on every pointer event/frame. */
  private cssWidth = 0;
  private cssHeight = 0;
  private cachedRect: DOMRect | null = null;
  /** Backing-store scale for crisp rendering on high-DPI screens; capped at 2x. */
  private dpr = 1;
  /** True while a pan/zoom/touch gesture is in progress — implicit curves and
   *  point-of-interest keys use a coarser grid / skip work while this is set,
   *  and settle to full detail once the gesture ends. */
  private gestureActive = false;

  /** Re-reads the canvas's CSS size, device-pixel ratio and bounding rect. Called from
   *  the ResizeObserver and at the start of a drag/touch gesture — not per event/frame. */
  private measureCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const parentWidth = parent?.clientWidth ?? 0;
    const parentHeight = parent?.clientHeight ?? 0;
    // Falls back to the canvas element's own (attribute) size when the parent hasn't
    // been laid out yet — e.g. jsdom in unit tests, which never computes real layout
    // and leaves clientWidth/clientHeight at 0, so tests size against the canvas's
    // default 300x150 the same way the pre-DPR-aware code implicitly did.
    const prevWidth = this.cssWidth;
    const prevHeight = this.cssHeight;
    this.cssWidth = parentWidth > 0 ? parentWidth : canvas.width || 300;
    this.cssHeight = parentHeight > 0 ? parentHeight : canvas.height || 150;
    this.cachedRect = canvas.getBoundingClientRect();
    // Equal x/y scale, like Desmos/GeoGebra: fit once on the first measurement (the
    // initial or share-link view), then keep the user's zoom across resizes.
    if (!this.aspectFitted) {
      this.viewport.fitAspect(this.cssWidth, this.cssHeight);
      this.aspectFitted = true;
    } else if (prevWidth !== this.cssWidth || prevHeight !== this.cssHeight) {
      this.viewport.keepScaleOnResize(prevWidth, this.cssWidth, this.cssHeight);
    }
    this.dpr =
      typeof devicePixelRatio !== 'undefined' && devicePixelRatio > 0
        ? Math.min(2, devicePixelRatio)
        : 1;
  }

  private aspectFitted = false;

  private getCanvasRect(canvas: HTMLCanvasElement): DOMRect {
    if (!this.cachedRect) this.cachedRect = canvas.getBoundingClientRect();
    return this.cachedRect;
  }

  private canvasListenerController: AbortController | null = null;

  // --- Mobile bottom-sheet drag (handle pointer events; see UiLayoutState for snap state) ---
  private sheetDragStartY = 0;
  private sheetDragStartHeight = 0;
  private sheetDragMoved = false;
  private sheetPointerController: AbortController | null = null;

  private currentSheetHeightPx(): number {
    if (!this.isBrowser) return 0;
    const vh = window.innerHeight;
    const snap = this.uiLayout.sheetSnap();
    return snap === 'full' ? vh * 0.92 : snap === 'half' ? vh * 0.5 : vh * 0.16;
  }

  onSheetHandlePointerDown(event: PointerEvent): void {
    if (!this.isBrowser) return;
    this.sheetDragStartY = event.clientY;
    this.sheetDragStartHeight = this.currentSheetHeightPx();
    this.sheetDragMoved = false;
    this.sheetPointerController?.abort();
    this.uiLayout.dragOffsetPx.set(this.sheetDragStartHeight);
    this.uiLayout.dragging.set(true);
    this.sheetPointerController = new AbortController();
    const { signal } = this.sheetPointerController;
    window.addEventListener('pointermove', (e) => this.onSheetPointerMove(e), { signal });
    window.addEventListener('pointerup', () => this.onSheetPointerUp(), { signal });
    window.addEventListener('pointercancel', () => this.onSheetPointerUp(), { signal });
  }

  private onSheetPointerMove(event: PointerEvent): void {
    const deltaY = this.sheetDragStartY - event.clientY;
    if (Math.abs(deltaY) > 6) this.sheetDragMoved = true;
    if (!this.sheetDragMoved) return;
    const vh = window.innerHeight;
    const next = Math.min(vh * 0.92, Math.max(vh * 0.12, this.sheetDragStartHeight + deltaY));
    this.uiLayout.dragOffsetPx.set(next);
  }

  private onSheetPointerUp(): void {
    this.sheetPointerController?.abort();
    this.sheetPointerController = null;
    this.uiLayout.dragging.set(false);
    if (this.sheetDragMoved) {
      const vh = window.innerHeight;
      const h = this.uiLayout.dragOffsetPx();
      const targets: Array<[SheetSnap, number]> = [
        ['peek', vh * 0.16],
        ['half', vh * 0.5],
        ['full', vh * 0.92],
      ];
      let best = targets[0][0];
      let bestDist = Infinity;
      for (const [snap, target] of targets) {
        const d = Math.abs(h - target);
        if (d < bestDist) {
          bestDist = d;
          best = snap;
        }
      }
      this.uiLayout.setSheet(best);
    }
    this.uiLayout.dragOffsetPx.set(0);
  }

  /** Tap (as opposed to drag) on the sheet handle: cycle to the next snap height.
   *  A prior drag already committed a snap in `onSheetPointerUp`, so this no-ops then. */
  onSheetHandleClick(): void {
    if (this.sheetDragMoved) {
      this.sheetDragMoved = false;
      return;
    }
    this.uiLayout.cycleSheet();
  }

  /** Opens/closes a tool panel via the tab bar, closing any other active tool first —
   *  the underlying activate/toggle methods remain the single source of truth. */
  selectTool(tab: ToolTab): void {
    const target = tab === this.uiLayout.activeTool() ? 'none' : tab;
    if (this.activeIntegral() && target !== 'integral') this.activeIntegral.set(null);
    if (this.showSolidTool() && target !== 'solids') this.toggleSolidTool();
    if (this.activeMultiArea() && target !== 'area') this.activeMultiArea.set(null);
    if (this.showConicAssistant() && target !== 'conics') this.showConicAssistant.set(false);
    if (target === 'integral' && !this.activeIntegral()) this.activateIntegral();
    else if (target === 'solids' && !this.showSolidTool()) this.toggleSolidTool();
    else if (target === 'area' && !this.activeMultiArea()) this.activateMultiArea();
    else if (target === 'conics') this.showConicAssistant.set(true);
    this.requestRender();
  }

  /** Attaches the canvas's pointer/wheel/touch handlers via addEventListener instead of
   *  template bindings, with `{ passive: false }` on wheel/touch (they call
   *  preventDefault to stop page scroll/zoom during a graph gesture) — a template
   *  binding can't express that. All listeners share one AbortController, removed in
   *  `ngOnDestroy`. */
  private attachCanvasListeners(canvas: HTMLCanvasElement): void {
    this.canvasListenerController = new AbortController();
    const { signal } = this.canvasListenerController;

    canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e), { signal });
    canvas.addEventListener('mouseleave', () => this.onCanvasMouseLeave(), { signal });
    canvas.addEventListener('wheel', (e) => this.onCanvasWheel(e), { passive: false, signal });
    canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e), { signal });
    canvas.addEventListener('mouseup', () => this.onCanvasMouseUp(), { signal });
    canvas.addEventListener('click', (e) => this.onCanvasClick(e), { signal });
    canvas.addEventListener('touchstart', (e) => this.onCanvasTouchStart(e), {
      passive: false,
      signal,
    });
    canvas.addEventListener('touchmove', (e) => this.onCanvasTouchMove(e), {
      passive: false,
      signal,
    });
    canvas.addEventListener('touchend', (e) => this.onCanvasTouchEnd(e), {
      passive: false,
      signal,
    });
    canvas.addEventListener('touchcancel', (e) => this.onCanvasTouchEnd(e), {
      passive: false,
      signal,
    });
    // Any scroll (page or ancestor) moves the canvas without resizing it, so the
    // ResizeObserver misses it — drop the cached rect and re-read it lazily.
    const invalidateRect = () => (this.cachedRect = null);
    window.addEventListener('scroll', invalidateRect, { passive: true, capture: true, signal });
    window.addEventListener('resize', invalidateRect, { passive: true, signal });
  }

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

  /** An evaluator closure for one "area between curves" function: an explicit curve
   *  evaluates its compiled AST directly, an implicit conic uses its first solved
   *  y-branch (matching `solveConicForY`, since `evalExpression`/`evaluate` don't
   *  understand a raw `lhs = rhs` equation AST — evaluating one throws). */
  private buildAreaEvalFn(
    f: MathExpression & { ast: ExpressionNode },
    au: 'rad' | 'deg',
  ): (x: number) => number {
    if (f.mode === 'explicit') {
      const compiled = compileExpression(f.ast, au);
      return (x) => compiled(x, 0);
    }
    const branches = solveConicForY(f.ast);
    if (branches && branches.length > 0) {
      const branchFn = branches[0].fn;
      return (x) => branchFn(x) ?? NaN;
    }
    const compiled = compileExpression(f.ast, au);
    return (x) => compiled(x, 0);
  }

  /** The "area between curves" tool's geometry (evaluator closures, intersections,
   *  regions) — entirely viewport-independent, so it's memoized here rather than
   *  recomputed on every pan/zoom render frame; `render()` only maps it to screen
   *  coordinates each frame. */
  private multiAreaGeometry = computed(() => {
    const mArea = this.activeMultiArea();
    if (!mArea) return null;
    const au = this.angleUnit();

    if (mArea.functionIndices.length >= 2) {
      const fns = mArea.functionIndices
        .map((i) => this.functions()[i])
        .filter(
          (e): e is MathExpression & { ast: NonNullable<MathExpression['ast']> } =>
            !!e?.ast && e.visible && this.canUseWithTools(e),
        );
      if (fns.length < 2) return null;
      const evalFns = fns.map((f) => this.buildAreaEvalFn(f, au));
      const intersections = findIntersections(evalFns, mArea.a, mArea.b);
      const regions = computeAreaRegions(evalFns, intersections, mArea.a, mArea.b);
      return {
        mode: 'multi' as const,
        fns,
        evalFns,
        intersections,
        regions,
        a: mArea.a,
        b: mArea.b,
      };
    }

    if (mArea.functionIndices.length === 1) {
      const expr = this.functions()[mArea.functionIndices[0]];
      if (!expr?.ast || !expr.visible || !this.canUseWithTools(expr)) return null;
      const fn = this.buildAreaEvalFn(expr as MathExpression & { ast: ExpressionNode }, au);
      return { mode: 'single' as const, expr, fn, a: mArea.a, b: mArea.b };
    }

    return null;
  });

  results = computed<IntegralResult[]>(() => {
    const res: IntegralResult[] = [];
    const au = this.angleUnit();
    const intg = this.activeIntegral();
    if (intg) {
      const expr = this.functions()[intg.fnIndex];
      if (expr?.ast && expr.visible && expr.mode !== 'explicit-y') {
        const compiled = compileExpression(expr.ast, au);
        const fn = (x: number) => compiled(x, 0);
        const result = integrateAdaptive(fn, intg.a, intg.b);
        const value =
          result.status === 'divergent'
            ? 'diverges'
            : result.status === 'undefined'
              ? `undefined near x ≈ ${result.badPoint?.toFixed(4) ?? '?'}`
              : formatValue(result.value);
        res.push({ label: `∫ ${expr.raw} dx`, value });
      }
    }
    // Solid-of-revolution / cross-section results are shown inline by <app-solid-panel>
    // (via SolidToolState), not duplicated in this footer.

    const geom = this.multiAreaGeometry();
    if (geom?.mode === 'multi') {
      let total = 0;
      for (const r of geom.regions) total += r.area;
      const labels = geom.fns.map((f) => f.raw).join(', ');
      res.push({ label: `A [${labels}]`, value: formatValue(total) });
    } else if (geom?.mode === 'single') {
      const value = areaSingle(geom.fn, geom.a, geom.b);
      res.push({ label: `A [${geom.expr.raw}]`, value: formatValue(value) });
    }

    return res;
  });

  constructor() {
    // Re-bind whenever the <canvas> element itself changes (dev-server HMR swaps the
    // template DOM without re-running ngAfterViewInit; any future @if around the canvas
    // would do the same). No-op while it's the element we're already bound to.
    afterRenderEffect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas && canvas !== this.boundCanvas && this.viewInitialized) {
        this.ngZone.runOutsideAngular(() => this.bindCanvas(canvas));
      }
    });

    this.solidToolState.connect(this.functions, this.angleUnit);
    this.uiLayout.connect(
      this.activeIntegral,
      this.showSolidTool,
      this.activeMultiArea,
      this.showConicAssistant,
    );

    // The 2D canvas is drawn imperatively (not from template bindings), so solid-panel
    // edits (method/axis/bounds/curve selection) need an explicit trigger to redraw —
    // otherwise the canvas keeps showing the previous axis line / filled region even
    // though the panel's own computed volume is already up to date.
    effect(() => {
      this.solidToolState.spec();
      this.solidToolState.result();
      this.solidToolState.sweepT();
      this.solidToolState.axisOrientation();
      // Leaving the 3D overlay must repaint the (possibly resized) 2D canvas.
      this.show3DSolid();
      if (!this.isBrowser) return;
      this.requestRender();
    });

    // Points of interest are memoized off the visible functions; invalidate and
    // recompute them the instant a function's text/visibility changes (add/edit/
    // remove/hide), rather than waiting for some other render to notice the key
    // changed — this also covers the case where a tool (e.g. solids) is active
    // and would otherwise be the only thing driving further renders.
    effect(() => {
      this.functions();
      this.poiKey = null;
      if (!this.isBrowser) return;
      if (this.interactionState.showPointsOfInterest()) {
        this.recomputePointsOfInterest();
        this.poiKey = this.poiComputeKey();
      }
      this.requestRender();
    });
  }

  ngAfterViewInit(): void {
    this.titleService.setTitle('Graphing Calculator — Andres Rincon');
    if (!this.isBrowser) return;
    this.restoreFromShareLink();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ngZone.runOutsideAngular(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.measureCanvas();
          this.requestRender();
        });
      }
      this.bindCanvas(canvas);
      this.viewInitialized = true;
      this.parseAll();
      this.render();
    });
  }

  private boundCanvas: HTMLCanvasElement | null = null;
  private viewInitialized = false;

  /** Points listeners, the ResizeObserver and cached measurements at `canvas`,
   *  releasing whatever element they were bound to before. */
  private bindCanvas(canvas: HTMLCanvasElement): void {
    if (canvas === this.boundCanvas) return;
    this.canvasListenerController?.abort();
    this.boundCanvas = canvas;
    this.cachedRect = null;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      if (canvas.parentElement) this.resizeObserver.observe(canvas.parentElement);
    }
    this.measureCanvas();
    this.attachCanvasListeners(canvas);
    this.requestRender();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.canvasListenerController?.abort();
    this.sheetPointerController?.abort();
    if (this.isBrowser) {
      cancelAnimationFrame(this.animFrameId);
      for (const id of this.pendingRafIds) cancelAnimationFrame(id);
      this.pendingRafIds = [];
    }
    if (this.blurTimerId !== null) {
      clearTimeout(this.blurTimerId);
      this.blurTimerId = null;
    }
    if (this.poiTimer !== null) {
      clearTimeout(this.poiTimer);
      this.poiTimer = null;
    }
    if (this.shareNoticeTimerId !== null) {
      clearTimeout(this.shareNoticeTimerId);
      this.shareNoticeTimerId = null;
    }
    if (this.wheelIdleTimerId !== null) {
      clearTimeout(this.wheelIdleTimerId);
      this.wheelIdleTimerId = null;
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
        error: null,
      },
    ]);
  }

  removeFunction(index: number): void {
    this.functions.update((fns) => fns.filter((_, i) => i !== index));
    if (this.functions().length < 2) {
      this.activeMultiArea.set(null);
    }
    this.solidToolState.handleFunctionRemoved(index);
    this.requestRender();
  }

  /** Parses a single-expression body, then probes it once at sample values to surface
   *  reference errors (e.g. a typo'd function name) that only throw at evaluation time. */
  private parseAndValidate(
    exprText: string,
    sampleVars: Record<string, number>,
  ): { ast: ExpressionNode | null; error: string | null } {
    if (!exprText.trim()) return { ast: null, error: null };
    let ast: ExpressionNode;
    try {
      ast = parse(exprText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ast: null, error: formatExpressionError(message, exprText) };
    }
    try {
      evaluate(ast, sampleVars, this.angleUnit());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ast: null, error: formatExpressionError(message, exprText) };
    }
    return { ast, error: null };
  }

  updateExpression(index: number, raw: string): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => {
        if (i !== index) return fn;
        const mode = this.detectMode(raw);
        const effectiveRaw = mode === 'explicit' ? this.stripYEquals(raw) : raw;
        if (mode === 'explicit-y') {
          const rhs = raw.trim().replace(/^[xX]\s*=\s*/, '');
          const { ast, error } = this.parseAndValidate(rhs, { y: 1 });
          return {
            ...fn,
            raw,
            ast,
            mode,
            paramX: null,
            paramY: null,
            inequalityOp: undefined,
            error,
          };
        }
        if (mode === 'implicit') {
          const inequalityMatch = raw.match(/(.*?)(>=|<=|>|<)(.*)/);
          if (inequalityMatch) {
            const lhs = inequalityMatch[1].trim();
            const op = inequalityMatch[2] as '>' | '<' | '>=' | '<=';
            const rhs = inequalityMatch[3].trim();
            if (/^y$/i.test(lhs)) {
              const { ast, error } = this.parseAndValidate(rhs, { x: 1 });
              return {
                ...fn,
                raw,
                ast,
                mode,
                paramX: null,
                paramY: null,
                inequalityOp: op,
                error,
              };
            }
            const { ast, error } = this.parseAndValidate(`(${lhs})-(${rhs})`, { x: 1, y: 1 });
            return { ...fn, raw, ast, mode, paramX: null, paramY: null, inequalityOp: op, error };
          }
          if (raw.includes('=')) {
            const eqIdx = raw.indexOf('=');
            const lhsText = raw.substring(0, eqIdx);
            const rhsText = raw.substring(eqIdx + 1);
            try {
              const lhs = parse(lhsText);
              const rhs = parse(rhsText);
              evaluate(lhs, { x: 1, y: 1 }, this.angleUnit());
              evaluate(rhs, { x: 1, y: 1 }, this.angleUnit());
              const ast: ExpressionNode = {
                type: 'BinaryOp',
                operator: '=',
                left: lhs,
                right: rhs,
              };
              return {
                ...fn,
                raw,
                ast,
                mode,
                paramX: null,
                paramY: null,
                inequalityOp: undefined,
                error: null,
              };
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return {
                ...fn,
                raw,
                ast: null,
                mode,
                paramX: null,
                paramY: null,
                inequalityOp: undefined,
                error: formatExpressionError(message, raw),
              };
            }
          }
          const { ast, error } = this.parseAndValidate(raw, { x: 1, y: 1 });
          return {
            ...fn,
            raw,
            ast,
            mode,
            paramX: null,
            paramY: null,
            inequalityOp: undefined,
            error,
          };
        }
        if (mode === 'parametric') {
          const parts = raw.split(',');
          if (parts.length === 2) {
            const xExpr = parts[0].trim().replace(/^[xX]\s*=\s*/, '');
            const yExpr = parts[1].trim().replace(/^[yY]\s*=\s*/, '');
            try {
              const paramX = parse(xExpr);
              const paramY = parse(yExpr);
              return {
                ...fn,
                raw,
                ast: null,
                mode,
                paramX,
                paramY,
                inequalityOp: undefined,
                error: null,
              };
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return {
                ...fn,
                raw,
                ast: null,
                mode,
                paramX: null,
                paramY: null,
                inequalityOp: undefined,
                error: formatExpressionError(message, raw),
              };
            }
          }
          return {
            ...fn,
            raw,
            ast: null,
            mode,
            paramX: null,
            paramY: null,
            inequalityOp: undefined,
            error: null,
          };
        }
        if (mode === 'polar') {
          const expr = raw.replace(/^r\s*=\s*/i, '');
          const { ast, error } = this.parseAndValidate(expr, { x: 1 });
          return {
            ...fn,
            raw,
            ast,
            mode,
            paramX: null,
            paramY: null,
            inequalityOp: undefined,
            error,
          };
        }
        const { ast, error } = this.parseAndValidate(effectiveRaw, { x: 1 });
        return {
          ...fn,
          raw,
          ast,
          mode: 'explicit',
          paramX: null,
          paramY: null,
          inequalityOp: undefined,
          error,
        };
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
    const modes: CurveMode[] = ['explicit', 'explicit-y', 'parametric', 'polar', 'implicit'];
    this.functions.update((fns) =>
      fns.map((fn, i) => {
        if (i !== index) return fn;
        const currentIdx = modes.indexOf(fn.mode);
        const nextMode = modes[(currentIdx + 1) % modes.length];
        return {
          ...fn,
          mode: nextMode,
          ast: null,
          paramX: null,
          paramY: null,
          inequalityOp: undefined,
        };
      }),
    );
    const fn = this.functions()[index];
    if (fn) this.updateExpression(index, fn.raw);
  }

  updateParamRange(
    index: number,
    field: 'tMin' | 'tMax' | 'thetaMin' | 'thetaMax',
    value: string,
  ): void {
    this.functions.update((fns) =>
      fns.map((fn, i) => (i === index ? { ...fn, [field]: value } : fn)),
    );
    this.requestRender();
  }

  private detectMode(raw: string): CurveMode {
    return detectCurveMode(raw);
  }

  private stripYEquals(raw: string): string {
    return raw.trim().replace(/^[yY]\s*=\s*/, '');
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
      this.closeSolidTool();
      this.activeMultiArea.set(null);
      this.activeIntegral.set({ fnIndex: 0, a: -2, b: 2 });
    }
    this.requestRender();
  }

  /** Opens/closes the "solids by integration" panel, seeding a first guess of curves/bounds. */
  toggleSolidTool(): void {
    if (this.showSolidTool()) {
      this.closeSolidTool();
      this.requestRender();
      return;
    }

    this.activeIntegral.set(null);
    this.activeMultiArea.set(null);
    this.showSolidTool.set(true);

    if (this.solidToolState.curveIndices().length === 0) {
      const visibles = this.functions()
        .map((f, i) => ({ f, i }))
        .filter((x) => x.f.visible && x.f.mode === 'explicit' && x.f.ast);
      const indices = visibles.slice(0, 2).map((x) => x.i);
      for (const i of indices) this.solidToolState.toggleCurve(i);

      let a = this.viewport.xMin;
      let b = this.viewport.xMax;

      if (indices.length === 1) {
        const expr = this.functions()[indices[0]];
        if (expr?.ast) {
          const evalFn = (x: number) => evalExpression(expr.ast!, x);
          const crossings = findAxisCrossings(evalFn, a, b, 0);
          if (crossings.length >= 2) {
            const sorted = [...crossings].sort((x, y) => Math.abs(x) - Math.abs(y));
            a = Math.min(sorted[0], sorted[1]);
            b = Math.max(sorted[0], sorted[1]);
          }
        }
      } else if (indices.length >= 2) {
        const evalFns = indices.map((i) => {
          const ast = this.functions()[i].ast!;
          return (x: number) => evalExpression(ast, x);
        });
        const intersections = findIntersections(evalFns, a, b);
        if (intersections.length >= 2) {
          const sorted = [...intersections].sort((p, q) => Math.abs(p.x) - Math.abs(q.x));
          a = Math.min(sorted[0].x, sorted[1].x);
          b = Math.max(sorted[0].x, sorted[1].x);
        }
      }

      this.solidToolState.setA(String(roundLimit(a)));
      this.solidToolState.setB(String(roundLimit(b)));
    }
    this.requestRender();
  }

  private closeSolidTool(): void {
    this.showSolidTool.set(false);
    this.show3DSolid.set(false);
    this.solidToolState.reset();
  }

  activateMultiArea(): void {
    const current = this.activeMultiArea();
    if (current) {
      this.activeMultiArea.set(null);
    } else {
      this.activeIntegral.set(null);
      this.closeSolidTool();
      const indices =
        this.functions().length >= 2 ? [0, 1] : this.functions().length === 1 ? [0] : [];

      let a = -2;
      let b = 2;

      if (indices.length === 1) {
        const expr = this.functions()[indices[0]];
        if (expr?.mode === 'implicit' && expr.ast) {
          const domain = detectConicDomain(expr.ast);
          if (domain) {
            a = domain[0].a;
            b = domain[0].b;
          }
        }
      } else if (indices.length >= 2) {
        const au = this.angleUnit();
        const fns = indices
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
          const intersections = findIntersections(evalFns, a, b);
          if (intersections.length >= 2) {
            const sorted = [...intersections].sort((p, q) => Math.abs(p.x) - Math.abs(q.x));
            a = Math.min(sorted[0].x, sorted[1].x);
            b = Math.max(sorted[0].x, sorted[1].x);
          }
        }
      }

      this.activeMultiArea.set({
        functionIndices: indices,
        a,
        b,
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
    const rect = this.getCanvasRect(canvas);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.mousePos.set({ x, y });

    if (this.isDragging()) {
      const last = this.lastDrag();
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        this.viewport.pan(dx, dy, this.cssWidth, this.cssHeight);
      }
      this.lastDrag.set({ x, y });
    }

    this.requestRender();
  }

  onCanvasMouseLeave(): void {
    this.mousePos.set(null);
    this.requestRender();
  }

  private wheelIdleTimerId: ReturnType<typeof setTimeout> | null = null;

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = this.getCanvasRect(canvas);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.viewport.zoom(factor, x, y, this.cssWidth, this.cssHeight);

    // A wheel/trackpad zoom fires many events in quick succession; treat it as one
    // gesture (coarser implicit-curve grid, no POI recompute) until it's quiet.
    this.gestureActive = true;
    if (this.wheelIdleTimerId !== null) clearTimeout(this.wheelIdleTimerId);
    this.wheelIdleTimerId = setTimeout(() => {
      this.wheelIdleTimerId = null;
      this.gestureActive = false;
      this.requestRender();
    }, 150);

    this.requestRender();
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) this.cachedRect = canvas.getBoundingClientRect();
    this.gestureActive = true;
    this.isDragging.set(true);
    this.lastDrag.set(null);
  }

  onCanvasMouseUp(): void {
    this.isDragging.set(false);
    this.lastDrag.set(null);
    this.gestureActive = false;
    this.requestRender();
  }

  /** Pins/unpins the nearest point of interest to a click/tap, within a wider hit
   *  radius on coarse (touch) pointers. */
  onCanvasClick(event: MouseEvent): void {
    if (!this.interactionState.showPointsOfInterest()) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const points = this.interactionState.pointsOfInterest();
    if (points.length === 0) return;

    const rect = this.getCanvasRect(canvas);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const hitRadius = coarse ? POI_HIT_PX_COARSE : POI_HIT_PX_FINE;

    let best: { point: PointOfInterest; distance: number } | null = null;
    for (const p of points) {
      const [sx, sy] = this.viewport.worldToScreen(p.x, p.y, this.cssWidth, this.cssHeight);
      const distance = Math.hypot(sx - x, sy - y);
      if (distance <= hitRadius && (!best || distance < best.distance)) {
        best = { point: p, distance };
      }
    }
    if (best) {
      this.interactionState.togglePin(best.point);
      this.requestRender();
    }
  }

  onCanvasKeyDown(event: KeyboardEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const PAN_STEP = 30;
    switch (event.key) {
      case '+':
      case '=':
        this.viewport.zoom(
          1.15,
          this.cssWidth / 2,
          this.cssHeight / 2,
          this.cssWidth,
          this.cssHeight,
        );
        break;
      case '-':
      case '_':
        this.viewport.zoom(
          1 / 1.15,
          this.cssWidth / 2,
          this.cssHeight / 2,
          this.cssWidth,
          this.cssHeight,
        );
        break;
      case 'ArrowLeft':
        this.viewport.pan(PAN_STEP, 0, this.cssWidth, this.cssHeight);
        break;
      case 'ArrowRight':
        this.viewport.pan(-PAN_STEP, 0, this.cssWidth, this.cssHeight);
        break;
      case 'ArrowUp':
        this.viewport.pan(0, PAN_STEP, this.cssWidth, this.cssHeight);
        break;
      case 'ArrowDown':
        this.viewport.pan(0, -PAN_STEP, this.cssWidth, this.cssHeight);
        break;
      case 'r':
      case 'R':
        this.resetView();
        return;
      case 'p':
      case 'P':
        this.cyclePointOfInterest();
        return;
      case 'Escape':
        if (this.interactionState.pinnedPoints().length > 0) {
          this.interactionState.clearPinned();
          this.requestRender();
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    this.requestRender();
  }

  /** Cycles the keyboard focus through the currently visible points of interest,
   *  announcing the current one via the canvas's aria-describedby region. */
  private cyclePointOfInterest(): void {
    if (!this.interactionState.showPointsOfInterest()) return;
    const next = this.interactionState.cycleNext();
    if (!next) {
      this.poiAnnouncement.set('No points of interest in view.');
      return;
    }
    const { point, index, total } = next;
    this.poiAnnouncement.set(
      `Point of interest ${index + 1} of ${total}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}), ${point.label}.`,
    );
    this.requestRender();
  }

  onCanvasTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.cachedRect = canvas.getBoundingClientRect();
    this.gestureActive = true;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.cachedRect;
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.touchAnchor = { x, y };
      this.touchPanEngaged = false;
      this.isDragging.set(false);
      this.lastDrag.set({ x, y });
      this.mousePos.set({ x, y });
      this.requestRender();
    } else if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      this.lastDrag.set({ x: Math.hypot(dx, dy), y: 0 });
    }
  }

  onCanvasTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.getCanvasRect(canvas);
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // A single finger holds still to trace a curve; it only commits to panning
      // once it has moved past a small threshold (a deliberate drag gesture).
      if (!this.touchPanEngaged && this.touchAnchor) {
        const moved = Math.hypot(x - this.touchAnchor.x, y - this.touchAnchor.y);
        if (moved > TOUCH_PAN_THRESHOLD_PX) {
          this.touchPanEngaged = true;
          this.isDragging.set(true);
        }
      }

      if (this.touchPanEngaged) {
        const last = this.lastDrag();
        if (last) {
          const dx = x - last.x;
          const dy = y - last.y;
          this.viewport.pan(dx, dy, this.cssWidth, this.cssHeight);
        }
      }
      this.lastDrag.set({ x, y });
      this.mousePos.set({ x, y });
      this.requestRender();
    } else if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const currentDist = Math.hypot(dx, dy);
      const last = this.lastDrag();
      const lastDist = last?.x ?? 0;
      if (lastDist > 0) {
        const factor = currentDist / lastDist;
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const rect = this.getCanvasRect(canvas);
        const cx = centerX - rect.left;
        const cy = centerY - rect.top;
        if (factor > 1.01 || factor < 0.99) {
          this.viewport.zoom(factor, cx, cy, this.cssWidth, this.cssHeight);
          this.requestRender();
        }
      }
      this.lastDrag.set({ x: currentDist, y: 0 });
    }
  }

  onCanvasTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      this.isDragging.set(false);
      this.lastDrag.set(null);
      this.touchAnchor = null;
      this.touchPanEngaged = false;
      this.mousePos.set(null);
      this.gestureActive = false;
      this.requestRender();
    } else if (event.touches.length === 1) {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        const touch = event.touches[0];
        const rect = this.getCanvasRect(canvas);
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.lastDrag.set({ x, y });
      }
    }
  }

  resetView(): void {
    this.viewport.reset();
    this.viewport.fitAspect(this.cssWidth, this.cssHeight);
    this.render();
  }

  zoomIn(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.viewport.zoom(1.3, this.cssWidth / 2, this.cssHeight / 2, this.cssWidth, this.cssHeight);
    this.requestRender();
  }

  zoomOut(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.viewport.zoom(
      1 / 1.3,
      this.cssWidth / 2,
      this.cssHeight / 2,
      this.cssWidth,
      this.cssHeight,
    );
    this.requestRender();
  }

  toggleGrid(): void {
    this.showGrid.update((v) => !v);
    this.requestRender();
  }

  togglePointsOfInterest(): void {
    this.interactionState.toggle();
    this.requestRender();
  }

  toggleAngleUnit(): void {
    this.angleUnit.update((u) => (u === 'deg' ? 'rad' : 'deg'));
  }

  /** Opens/closes the table-of-values panel for a function row (toggles closed if already open). */
  toggleValueTable(index: number): void {
    this.tableOpenIndex.update((cur) => (cur === index ? null : index));
  }

  canShowValueTable(fn: MathExpression): boolean {
    return fn.visible && (fn.mode === 'explicit' || fn.mode === 'explicit-y') && !!fn.ast;
  }

  updateColor(index: number, color: string): void {
    this.functions.update((fns) => fns.map((fn, i) => (i === index ? { ...fn, color } : fn)));
    this.requestRender();
  }

  private buildShareState(): ShareState {
    const active = this.activeIntegral()
      ? 'integral'
      : this.showSolidTool()
        ? 'solid'
        : this.activeMultiArea()
          ? 'area'
          : null;
    const intg = this.activeIntegral();
    const area = this.activeMultiArea();
    const state: ShareState = {
      v: 1,
      functions: this.functions().map((f) => ({ raw: f.raw, color: f.color, visible: f.visible })),
      viewport: {
        xMin: this.viewport.xMin,
        xMax: this.viewport.xMax,
        yMin: this.viewport.yMin,
        yMax: this.viewport.yMax,
      },
      tool: { active },
    };
    if (intg) state.tool.integral = { fnIndex: intg.fnIndex, a: intg.a, b: intg.b };
    if (area) {
      state.tool.area = {
        functionIndices: area.functionIndices,
        a: area.a,
        b: area.b,
        overlapMode: area.overlapMode,
      };
    }
    if (this.showSolidTool()) {
      state.tool.solid = {
        method: this.solidToolState.method(),
        curveIndices: this.solidToolState.curveIndices(),
        a: this.solidToolState.aText(),
        b: this.solidToolState.bText(),
        axisValue: this.solidToolState.axisValueText(),
        shape: this.solidToolState.shape(),
        heightRatio: this.solidToolState.heightRatioText(),
      };
    }
    return state;
  }

  /** Copies a shareable URL (current functions/viewport/active tool) to the clipboard. */
  async share(): Promise<void> {
    if (!this.isBrowser) return;
    const hash = buildShareHash(this.buildShareState());
    const url = `${location.origin}${location.pathname}${location.search}${hash}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        this.copyViaFallbackInput(url);
      }
      this.announceShare('Link copied');
    } catch {
      this.copyViaFallbackInput(url);
      this.announceShare('Link copied');
    }
  }

  private copyViaFallbackInput(url: string): void {
    const input = document.createElement('input');
    input.value = url;
    input.readOnly = true;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
    } catch {
      /* clipboard unavailable; the input still shows the URL if focus lands there */
    }
    document.body.removeChild(input);
  }

  private announceShare(message: string): void {
    if (this.shareNoticeTimerId !== null) clearTimeout(this.shareNoticeTimerId);
    this.shareNotice.set(message);
    this.shareNoticeTimerId = setTimeout(() => this.shareNotice.set(''), 3000);
  }

  private restoreFromShareLink(): void {
    const fragment = this.pendingShareFragment;
    this.pendingShareFragment = null;
    if (!fragment) return;
    const state = parseShareState(fragment);
    if (!state) {
      this.announceShare('Ignored an invalid share link.');
      this.clearShareHash();
      return;
    }

    this.functions.set(
      state.functions.map((f) => ({
        raw: f.raw,
        ast: null,
        color: f.color,
        visible: f.visible,
        mode: 'explicit' as const,
        error: null,
      })),
    );
    state.functions.forEach((f, i) => this.updateExpression(i, f.raw));

    this.viewport.xMin = state.viewport.xMin;
    this.viewport.xMax = state.viewport.xMax;
    this.viewport.yMin = state.viewport.yMin;
    this.viewport.yMax = state.viewport.yMax;

    const tool = state.tool;
    if (tool.active === 'integral' && tool.integral) {
      this.activeIntegral.set(tool.integral);
    } else if (tool.active === 'area' && tool.area) {
      this.activeMultiArea.set({
        functionIndices: tool.area.functionIndices,
        a: tool.area.a,
        b: tool.area.b,
        autoDetectIntersections: true,
        overlapMode: tool.area.overlapMode,
      });
    } else if (tool.active === 'solid' && tool.solid) {
      this.showSolidTool.set(true);
      this.solidToolState.setMethod(tool.solid.method);
      for (const idx of tool.solid.curveIndices) this.solidToolState.toggleCurve(idx);
      this.solidToolState.setA(tool.solid.a);
      this.solidToolState.setB(tool.solid.b);
      this.solidToolState.setAxisValue(tool.solid.axisValue);
      this.solidToolState.setShape(tool.solid.shape);
      this.solidToolState.setHeightRatio(tool.solid.heightRatio);
    }

    this.clearShareHash();
    this.requestRender();
  }

  /** Drops the `#s=...` fragment from the URL once it's been applied (or rejected), so a
   *  reload/back-navigation doesn't silently re-restore (or re-reject) stale shared state. */
  private clearShareHash(): void {
    if (!this.isBrowser || typeof history === 'undefined') return;
    history.replaceState(null, '', location.pathname + location.search);
  }

  /** Exports the 2D canvas as a PNG, or the 3D view's canvas when it's the one on screen. */
  exportPng(): void {
    if (!this.isBrowser) return;
    if (this.show3DSolid() && this.hasSolidResult()) {
      const canvas = this.solid3dRef()?.exportCanvas();
      if (canvas) downloadCanvasAsPng(canvas, 'graph.png');
      return;
    }
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) downloadCanvasAsPng(canvas, 'graph.png');
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
    this.reorderFunction(sourceIndex, targetIndex);
    this.dragIndex.set(null);
  }

  onDragEnd(): void {
    this.dragIndex.set(null);
  }

  /** Moves the function row at `sourceIndex` to `targetIndex`, keeping the active
   *  integral/solid-tool selections pointed at the same underlying function.
   *  Shared by drag-and-drop and the keyboard-accessible move up/down controls. */
  private reorderFunction(sourceIndex: number, targetIndex: number): void {
    this.functions.update((fns) => {
      const updated = [...fns];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });

    this.solidToolState.handleFunctionMoved(sourceIndex, targetIndex);

    if (this.activeIntegral()) {
      this.activeIntegral.update((intg) => {
        if (!intg) return null;
        let newIdx = intg.fnIndex;
        if (intg.fnIndex === sourceIndex) newIdx = targetIndex;
        else if (
          sourceIndex < targetIndex &&
          intg.fnIndex > sourceIndex &&
          intg.fnIndex <= targetIndex
        )
          newIdx = intg.fnIndex - 1;
        else if (
          sourceIndex > targetIndex &&
          intg.fnIndex >= targetIndex &&
          intg.fnIndex < sourceIndex
        )
          newIdx = intg.fnIndex + 1;
        return { ...intg, fnIndex: newIdx };
      });
    }

    this.requestRender();
  }

  /** Label used in the aria-live announcement and aria-labels for the move up/down controls. */
  functionLabel(index: number): string {
    const fn = this.functions()[index];
    return fn?.raw?.trim() ? `function ${index + 1}, ${fn.raw}` : `function ${index + 1}`;
  }

  canMoveFunctionUp(index: number): boolean {
    return index > 0;
  }

  canMoveFunctionDown(index: number): boolean {
    return index < this.functions().length - 1;
  }

  moveFunctionUp(index: number): void {
    if (!this.canMoveFunctionUp(index)) return;
    const label = this.functionLabel(index);
    this.reorderFunction(index, index - 1);
    this.moveAnnouncement.set(`Moved ${label} up to position ${index}`);
  }

  moveFunctionDown(index: number): void {
    if (!this.canMoveFunctionDown(index)) return;
    const label = this.functionLabel(index);
    this.reorderFunction(index, index + 1);
    this.moveAnnouncement.set(`Moved ${label} down to position ${index + 2}`);
  }

  /** Alt+ArrowUp / Alt+ArrowDown on a function's expression input reorders that row,
   *  reusing the same move logic as the drag handles and the move up/down buttons. */
  onFnInputKeyDown(index: number, event: KeyboardEvent): void {
    if (!event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveFunctionUp(index);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveFunctionDown(index);
    }
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
        error: null,
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
    const { value: v, invalid } = parseLimitText(value);
    this.limitErrors.update((e) => ({ ...e, [key]: invalid }));
    return v;
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

  /** Visible explicit / x=g(y) curves, as compiled evaluator closures (built once per
   *  (ast, angle unit) and reused — see `compileExpression`), for the trace search. */
  private buildTraceCurves(): TraceCurve[] {
    const au = this.angleUnit();
    const curves: TraceCurve[] = [];
    this.functions().forEach((fn, index) => {
      if (!fn.visible || !fn.ast) return;
      if (fn.mode === 'explicit') {
        const compiled = compileExpression(fn.ast, au);
        curves.push({
          index,
          color: fn.color,
          mode: 'explicit',
          fn: (x: number) => compiled(x, 0),
        });
      } else if (fn.mode === 'explicit-y') {
        const compiled = compileExpression(fn.ast, au);
        curves.push({
          index,
          color: fn.color,
          mode: 'explicit-y',
          fn: (y: number) => compiled(0, y),
        });
      }
    });
    return curves;
  }

  /** Visible explicit curves, labeled by function slot, for the points-of-interest engine. */
  private buildNamedCurves(): NamedCurve[] {
    const au = this.angleUnit();
    const curves: NamedCurve[] = [];
    this.functions().forEach((fn, index) => {
      if (!fn.visible || !fn.ast || fn.mode !== 'explicit') return;
      const compiled = compileExpression(fn.ast, au);
      curves.push({
        label: `f${index + 1}`,
        fn: (x: number) => compiled(x, 0),
      });
    });
    return curves;
  }

  private poiComputeKey(): string {
    const v = this.viewport;
    const fnsKey = this.functions()
      .map((f) => `${f.mode}:${f.visible}:${f.ast ? '1' : '0'}:${f.raw}`)
      .join('|');
    return `${v.xMin.toFixed(4)},${v.xMax.toFixed(4)}|${fnsKey}`;
  }

  /** Recomputes points of interest at most once per POI_RECOMPUTE_DELAY_MS, so panning
   *  or zooming doesn't re-run root/extrema/intersection search every frame. Skipped
   *  entirely while a gesture is active — not just debounced — so the key string
   *  itself isn't rebuilt every drag frame; the trailing recompute runs once the
   *  gesture ends (mouseup/touchend/wheel-idle already trigger a render). */
  private schedulePoiRecompute(): void {
    if (this.gestureActive) return;
    if (this.poiComputeKey() === this.poiKey) return;
    if (this.poiTimer !== null) return;
    this.poiTimer = setTimeout(() => {
      this.poiTimer = null;
      this.poiKey = this.poiComputeKey();
      this.recomputePointsOfInterest();
      this.requestRender();
    }, POI_RECOMPUTE_DELAY_MS);
  }

  private recomputePointsOfInterest(): void {
    const curves = this.buildNamedCurves();
    const points =
      curves.length > 0
        ? computePointsOfInterest(curves, this.viewport.xMin, this.viewport.xMax)
        : [];
    this.interactionState.setPoints(points);
  }

  /** Parsed once per edit (keyed by the MathExpression object itself, which
   *  `updateExpression` only replaces for the row actually being edited) instead of
   *  re-splitting/re-parsing `"(lhs)-(rhs)"` from the raw text on every render frame. */
  private implicitDiffAstCache = new WeakMap<MathExpression, ExpressionNode>();

  /** `detectConic` is viewport-independent (only depends on the AST), so it's cached
   *  per-AST here instead of re-run on every render frame for every implicit function. */
  private conicInfoCache = new WeakMap<ExpressionNode, ConicInfo | null>();

  private getConicInfo(ast: ExpressionNode): ConicInfo | null {
    if (this.conicInfoCache.has(ast)) return this.conicInfoCache.get(ast) ?? null;
    const info = detectConic(ast);
    this.conicInfoCache.set(ast, info);
    return info;
  }

  private getImplicitDiffAst(fn: MathExpression): ExpressionNode | null {
    const cached = this.implicitDiffAstCache.get(fn);
    if (cached) return cached;
    const parts = fn.raw.split('=');
    if (parts.length !== 2) return null;
    try {
      const expr = parse(`(${parts[0].trim()})-(${parts[1].trim()})`);
      this.implicitDiffAstCache.set(fn, expr);
      return expr;
    } catch {
      return null;
    }
  }

  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Backing store is sized in device pixels (capped at 2x) for crisp rendering on
    // high-DPI screens; every draw call below still works in CSS px (`w`/`h`), matching
    // mouse/touch coordinates — ctx.setTransform bridges the two.
    const targetWidth = Math.max(1, Math.round(this.cssWidth * this.dpr));
    const targetHeight = Math.max(1, Math.round(this.cssHeight * this.dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const w = this.cssWidth;
    const h = this.cssHeight;
    const au = this.angleUnit();
    const coarse = this.gestureActive;

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
          const compiled = compileExpression(fn.ast, au);
          const isExplicit = /^\s*y\s*(>=|<=|>|<)/i.test(fn.raw);
          if (isExplicit) {
            const evalFn = (x: number) => compiled(x, 0);
            drawInequality(ctx, this.viewport, evalFn, fn.inequalityOp, fn.color, w, h);
          } else {
            drawImplicitInequality(
              ctx,
              this.viewport,
              compiled,
              fn.inequalityOp,
              fn.color,
              w,
              h,
              coarse,
            );
          }
        } else {
          if (!fn.raw.includes('=')) continue;
          // A recognized conic (circle/ellipse/parabola/hyperbola) is drawn
          // parametrically — ~300 points — instead of the marching-squares grid;
          // `fn.ast` is already the raw `lhs = rhs` equation detectConic expects.
          const conic = fn.ast ? this.getConicInfo(fn.ast) : null;
          if (conic && drawConicCurve(ctx, this.viewport, conic, fn.color, w, h)) {
            continue;
          }
          const diffAst = this.getImplicitDiffAst(fn);
          if (!diffAst) continue;
          const compiled = compileExpression(diffAst, au);
          drawImplicitCurve(ctx, this.viewport, compiled, fn.color, w, h, coarse);
        }
      } else if (fn.mode === 'parametric') {
        if (!fn.paramX || !fn.paramY) continue;
        const compiledX = compileExpression(fn.paramX, au);
        const compiledY = compileExpression(fn.paramY, au);
        const evalX = (tVal: number) => compiledX(tVal, 0);
        const evalY = (tVal: number) => compiledY(tVal, 0);
        const tMin = this.evalRange(fn.tMin, 0);
        const tMax = this.evalRange(fn.tMax, 2 * Math.PI);
        drawParametric(ctx, this.viewport, evalX, evalY, tMin, tMax, fn.color, w, h);
      } else if (fn.mode === 'polar') {
        if (!fn.ast) continue;
        const compiled = compileExpression(fn.ast, au);
        const evalR = (theta: number) => compiled(theta, 0);
        const thetaMin = this.evalRange(fn.thetaMin, 0);
        const thetaMax = this.evalRange(fn.thetaMax, 2 * Math.PI);
        drawPolar(ctx, this.viewport, evalR, thetaMin, thetaMax, fn.color, w, h);
      } else if (fn.mode === 'explicit-y') {
        if (!fn.ast) continue;
        const compiled = compileExpression(fn.ast, au);
        const evalG = (y: number) => compiled(0, y);
        drawExplicitY(ctx, this.viewport, evalG, fn.color, w, h);
      } else {
        if (!fn.ast) continue;
        const compiled = compileExpression(fn.ast, au);
        const evalFn = (x: number) => compiled(x, 0);
        drawFunction(ctx, this.viewport, evalFn, fn.color, w, h, fn.ast);
        const asymptotes = detectAsymptotes(evalFn, this.viewport.xMin, this.viewport.xMax, fn.ast);
        for (const a of asymptotes) {
          drawAsymptote(ctx, this.viewport, a, w, h);
        }
      }
    }

    const intg = this.activeIntegral();
    if (intg) {
      const expr = this.functions()[intg.fnIndex];
      if (expr?.ast && expr.visible && expr.mode !== 'explicit-y') {
        const compiled = compileExpression(expr.ast, au);
        const fn = (x: number) => compiled(x, 0);
        drawIntegralArea(ctx, this.viewport, fn, intg.a, intg.b, expr.color, w, h);
      }
    }

    // Geometry (evaluator closures / intersections / regions) is memoized in
    // `multiAreaGeometry` — viewport-independent, so it isn't recomputed here on
    // every pan/zoom frame; this just maps it to the current screen coordinates.
    // Also fixes a bug where an implicit conic's evalFn always went through
    // `evalExpression` on the raw `lhs = rhs` AST (an unsupported operator, so it
    // threw) instead of branching through `solveConicForY` like `buildAreaEvalFn` does.
    const geom = this.multiAreaGeometry();
    if (geom?.mode === 'multi') {
      const { fns, evalFns, intersections, regions } = geom;
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
    } else if (geom?.mode === 'single') {
      drawIntegralArea(ctx, this.viewport, geom.fn, geom.a, geom.b, geom.expr.color, w, h);
    }

    if (this.showSolidTool()) {
      const spec = this.solidToolState.spec();
      const result = this.solidToolState.result();
      if (spec && result) {
        drawSolidRegion(
          ctx,
          this.viewport,
          spec,
          result.pieces,
          this.solidToolState.sweepT(),
          w,
          h,
        );
      }
    }

    if (this.interactionState.showPointsOfInterest()) {
      this.schedulePoiRecompute();
      const activeIndex = this.interactionState.activeIndex();
      const pinned = this.interactionState.pinnedPoints();
      this.interactionState.pointsOfInterest().forEach((p, i) => {
        const [sx, sy] = this.viewport.worldToScreen(p.x, p.y, w, h);
        const isActive = i === activeIndex;
        const pin = pinned.find((pt) => Math.abs(pt.x - p.x) < 1e-9 && Math.abs(pt.y - p.y) < 1e-9);
        const label =
          isActive || pin ? `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}) · ${p.label}` : null;
        drawPointOfInterest(ctx, sx, sy, p.x, p.y, label, isActive || !!pin, w, h);
      });
    }

    const mouse = this.mousePos();
    if (mouse && !this.isDragging()) {
      const traceCurves = this.buildTraceCurves();
      const trace = findNearestCurvePoint(
        traceCurves,
        mouse.x,
        mouse.y,
        this.viewport,
        w,
        h,
        TRACE_SNAP_PX,
      );
      if (trace) {
        drawTracePoint(
          ctx,
          trace.screenX,
          trace.screenY,
          trace.worldX,
          trace.worldY,
          trace.color,
          w,
          h,
        );
      } else {
        const intgFn = this.activeIntegral();
        let activeFn: ((x: number) => number) | null = null;
        if (intgFn) {
          const expr = this.functions()[intgFn.fnIndex];
          if (expr?.ast && expr.visible) {
            const compiled = compileExpression(expr.ast, au);
            activeFn = (x: number) => compiled(x, 0);
          }
        }
        drawCrosshair(ctx, this.viewport, mouse.x, mouse.y, activeFn, '#666680', w, h);
      }
    }
  }
}
