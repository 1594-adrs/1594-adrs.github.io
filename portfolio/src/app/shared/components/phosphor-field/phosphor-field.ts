import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  PLATFORM_ID,
  DestroyRef,
  NgZone,
  inject,
  input,
  effect,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CELL_SIZE = 16;
const BASE_MIN_ALPHA = 0.06;
const BASE_MAX_ALPHA = 0.12;
const LIT_MAX_ALPHA = 0.5;
const HEAT_DECAY_MS = 550;
const HEAT_EPSILON = 0.02;
/** Base layer tick cadence while the user is actively scrolling/pointing (≤5fps). */
const BASE_REFRESH_MS = 200;
/** Base layer tick cadence once idle — the drift is still visible but far cheaper. */
const IDLE_BASE_REFRESH_MS = 1000;
/** How long since the last pointer/scroll activity before we drop to the idle cadence. */
const IDLE_AFTER_MS = 3000;
const LOW_POWER_FRAME_MS = 1000 / 30;
/** Minimum re-render gap for the base layer while scrolling between sections. */
const SCROLL_BASE_REFRESH_MS = 60;
/** Resize events on touch devices that only change height by less than this (mobile URL bar
 * show/hide) don't warrant rebuilding the canvas and cell grid. */
const TOUCH_RESIZE_HEIGHT_THRESHOLD_PX = 120;

/**
 * One background theme per section, in page order. `ramp` goes dimmest to brightest
 * (spaces render nothing); `sample` shapes the drifting pattern.
 */
interface FieldTheme {
  id: string;
  ramp: string;
  rgb: string;
  sample: (x: number, y: number, t: number) => number;
}

const THEMES: FieldTheme[] = [
  // Hero: classic ASCII density field.
  { id: 'home', ramp: ' .:-+*#%@', rgb: '0, 255, 136', sample: (x, y, t) => fieldNoise(x, y, t) },
  // About: memory dump, binary columns drifting down.
  {
    id: 'about',
    ramp: '  01',
    rgb: '0, 255, 136',
    sample: (x, y, t) => fieldNoise(x * 1.8, y * 0.35 - t * 2.2, t * 0.5),
  },
  // Experience: log lines, horizontal streaks sliding sideways.
  {
    id: 'experience',
    ramp: ' .-=|',
    rgb: '0, 230, 200',
    sample: (x, y, t) => fieldNoise(x * 0.3 - t * 2.5, y * 1.9, t * 0.4),
  },
  // Projects: source code glyphs.
  {
    id: 'projects',
    ramp: ' .</>{}[]',
    rgb: '0, 204, 255',
    sample: (x, y, t) => fieldNoise(x * 0.9, y * 0.9 + t * 0.6, t),
  },
];

/** The dim base layer uses a few quantized alphas so it can be drawn in batches. */
const BASE_ALPHA_LEVELS = 6;
const BASE_STYLES = THEMES.flatMap((theme) =>
  Array.from({ length: BASE_ALPHA_LEVELS }, (_, level) => {
    const alpha =
      BASE_MIN_ALPHA + ((level + 0.5) / BASE_ALPHA_LEVELS) * (BASE_MAX_ALPHA - BASE_MIN_ALPHA);
    return `rgba(${theme.rgb}, ${alpha.toFixed(3)})`;
  }),
);

/** Lit glyphs are batched the same way; their ramps skip the blank entries. */
const LIT_ALPHA_LEVELS = 8;
const LIT_RAMPS = THEMES.map((theme) => theme.ramp.trimStart());
const LIT_STYLES = THEMES.flatMap((theme) =>
  Array.from({ length: LIT_ALPHA_LEVELS }, (_, level) => {
    const value = (level + 0.5) / LIT_ALPHA_LEVELS;
    const alpha = Math.min(LIT_MAX_ALPHA, value * LIT_MAX_ALPHA + 0.05);
    return `rgba(${theme.rgb}, ${alpha.toFixed(3)})`;
  }),
);

interface SectionAnchor {
  top: number;
  themeIndex: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Cheap deterministic drifting value noise, normalized to 0..1. */
function fieldNoise(x: number, y: number, t: number): number {
  const n =
    Math.sin(x * 0.15 + t * 0.6) +
    Math.sin(y * 0.13 - t * 0.5) +
    Math.sin((x + y) * 0.08 + t * 0.35) +
    Math.sin((x - y) * 0.11 - t * 0.25);
  return n / 8 + 0.5;
}

@Component({
  selector: 'app-phosphor-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phosphor-field.html',
  styleUrl: './phosphor-field.css',
  host: { role: 'presentation', 'aria-hidden': 'true' },
})
export class PhosphorField {
  active = input(true);

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private reducedMotionQuery?: MediaQueryList;
  private isLowPower = false;

  private cols = 0;
  private rows = 0;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  private ctx?: CanvasRenderingContext2D;
  private offscreen?: HTMLCanvasElement;
  private offscreenCtx?: CanvasRenderingContext2D;

  /** row*cols + col -> current heat (0..1) */
  private heat = new Map<number, number>();
  private sections: SectionAnchor[] = [];
  /** Continuous section position: 1.4 = 40% of the way from section 1 to section 2. */
  private sectionPos = 0;
  /** Per-cell random threshold (0..1) that drives the dissolve between themes. */
  private cellHash = new Float32Array(0);
  private lastBaseRenderAt = 0;
  /** Flat [col, row, rampIndex, ...] lists, one per theme × alpha level (reused between renders). */
  private baseBuckets: number[][] = BASE_STYLES.map(() => []);
  /** Flat [key, heat, ...] lists, one per theme × lit alpha level. */
  private litBuckets: number[][] = LIT_STYLES.map(() => []);

  private noiseTime = 0;
  private lastFrameTime = 0;
  private rafId = 0;
  private baseIntervalId?: ReturnType<typeof setInterval>;
  private lastActivityAt = 0;
  private disposed = false;

  private onResize = () => this.handleResize();
  private onPointerMove = (e: PointerEvent) => this.handlePointer(e.clientX, e.clientY);
  private onScroll = () => this.handleScroll();
  private onVisibilityChange = () => this.syncRunningState();
  private onReducedMotionChange = () => this.setupCanvas();

  constructor() {
    if (!this.isBrowser) return;

    afterNextRender(() => {
      this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.isLowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || window.innerWidth < 768;

      this.setupCanvas();

      this.ngZone.runOutsideAngular(() => {
        window.addEventListener('resize', this.onResize, { passive: true });
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
        window.addEventListener('scroll', this.onScroll, { passive: true });
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.reducedMotionQuery?.addEventListener('change', this.onReducedMotionChange);
      });

      this.destroyRef.onDestroy(() => this.teardown());
    });

    effect(() => {
      const isActive = this.active();
      if (!this.isBrowser || this.disposed) return;
      if (isActive) {
        this.setupCanvas();
      } else {
        this.stopRaf();
        this.stopBaseInterval();
        this.clearCanvas();
      }
    });
  }

  private prefersReducedMotion(): boolean {
    return this.reducedMotionQuery?.matches ?? false;
  }

  private setupCanvas(): void {
    if (!this.isBrowser || this.disposed || !this.active()) return;

    const canvas = this.canvasRef().nativeElement;
    this.cssWidth = window.innerWidth;
    this.cssHeight = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.ceil(this.cssWidth * this.dpr);
    canvas.height = Math.ceil(this.cssHeight * this.dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx = ctx;

    this.cols = Math.ceil(this.cssWidth / CELL_SIZE) + 1;
    this.rows = Math.ceil(this.cssHeight / CELL_SIZE) + 1;

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    offCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    offCtx.font = `${CELL_SIZE - 2}px "JetBrains Mono", monospace`;
    offCtx.textBaseline = 'top';
    this.offscreen = offscreen;
    this.offscreenCtx = offCtx;

    this.heat.clear();
    this.cellHash = new Float32Array(this.cols * this.rows);
    for (let i = 0; i < this.cellHash.length; i++) {
      // Integer hash: stable pseudo-random value per cell.
      let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      this.cellHash[i] = ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
    }
    this.readSectionAnchors();
    this.renderBaseLayer();
    this.drawFrame();

    this.stopBaseInterval();
    if (this.prefersReducedMotion()) {
      return;
    }
    this.baseIntervalId = setInterval(() => this.tickBaseLayer(), BASE_REFRESH_MS);
  }

  private handleResize(): void {
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const widthChanged = window.innerWidth !== this.cssWidth;
    const heightDelta = Math.abs(window.innerHeight - this.cssHeight);

    // Ignore mobile URL-bar show/hide: same width, small height delta, touch device.
    if (isCoarsePointer && !widthChanged && heightDelta < TOUCH_RESIZE_HEIGHT_THRESHOLD_PX) {
      return;
    }

    this.setupCanvas();
  }

  private readSectionAnchors(): void {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const anchors: SectionAnchor[] = [];
    THEMES.forEach((theme, themeIndex) => {
      const el = document.getElementById(theme.id);
      if (!el) return;
      anchors.push({ top: el.getBoundingClientRect().top + scrollY, themeIndex });
    });
    this.sections = anchors.sort((a, b) => a.top - b.top);
  }

  private computeSectionPos(): number {
    if (this.sections.length === 0) return 0;
    const viewportCenter =
      (window.scrollY || document.documentElement.scrollTop) + this.cssHeight / 2;

    let prev = this.sections[0];
    if (viewportCenter <= prev.top) return prev.themeIndex;
    for (let i = 1; i < this.sections.length; i++) {
      const next = this.sections[i];
      if (viewportCenter <= next.top) {
        const t = (viewportCenter - prev.top) / (next.top - prev.top || 1);
        // Hold the current theme for most of the section, dissolve as the next one arrives.
        return prev.themeIndex + smoothstep(0.45, 0.95, t) * (next.themeIndex - prev.themeIndex);
      }
      prev = next;
    }
    return prev.themeIndex;
  }

  /** Theme shown by a cell: cells flip to the next theme as the dissolve progresses. */
  private themeIndexForCell(key: number): number {
    const base = Math.floor(this.sectionPos);
    const frac = this.sectionPos - base;
    const next = Math.min(THEMES.length - 1, base + 1);
    return frac > 0 && this.cellHash[key] < frac ? next : base;
  }

  private tickBaseLayer(): void {
    if (!this.active()) return;

    // Drop to a much cheaper cadence once idle — the drift is still visible, just slower.
    const now = performance.now();
    const idleFor = now - this.lastActivityAt;
    const minGap = idleFor > IDLE_AFTER_MS ? IDLE_BASE_REFRESH_MS : BASE_REFRESH_MS;
    if (now - this.lastBaseRenderAt < minGap) return;

    this.noiseTime += (now - this.lastBaseRenderAt) / 1000;
    this.readSectionAnchors();
    this.renderBaseLayer();
    if (!this.rafRunning()) {
      this.drawFrame();
    }
  }

  private renderBaseLayer(): void {
    const ctx = this.offscreenCtx;
    if (!ctx) return;
    this.sectionPos = this.computeSectionPos();
    this.lastBaseRenderAt = performance.now();

    // Bucket glyphs by (theme, alpha level) so fillStyle — the costly part — is set a few
    // dozen times per render instead of once per cell.
    const buckets = this.baseBuckets;
    for (const bucket of buckets) bucket.length = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const themeIndex = this.themeIndexForCell(row * this.cols + col);
        const theme = THEMES[themeIndex];
        const value = clamp01(theme.sample(col, row, this.noiseTime));
        const rampIndex = Math.min(theme.ramp.length - 1, Math.floor(value * theme.ramp.length));
        if (theme.ramp[rampIndex] === ' ') continue;
        const level = Math.min(BASE_ALPHA_LEVELS - 1, Math.floor(value * BASE_ALPHA_LEVELS));
        buckets[themeIndex * BASE_ALPHA_LEVELS + level].push(col, row, rampIndex);
      }
    }

    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    buckets.forEach((cells, index) => {
      if (cells.length === 0) return;
      const theme = THEMES[Math.floor(index / BASE_ALPHA_LEVELS)];
      ctx.fillStyle = BASE_STYLES[index];
      for (let i = 0; i < cells.length; i += 3) {
        ctx.fillText(theme.ramp[cells[i + 2]], cells[i] * CELL_SIZE, cells[i + 1] * CELL_SIZE);
      }
    });
  }

  private handlePointer(clientX: number, clientY: number): void {
    if (!this.active() || this.prefersReducedMotion()) return;
    const col = Math.round(clientX / CELL_SIZE);
    const row = Math.round(clientY / CELL_SIZE);
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;
        const r = row + dy;
        const c = col + dx;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        const key = r * this.cols + c;
        const intensity = 1 - dist / (radius + 1);
        this.heat.set(key, Math.max(this.heat.get(key) ?? 0, intensity));
      }
    }
    this.lastActivityAt = performance.now();
    this.startRaf();
  }

  private lastScrollY = 0;
  private lastScrollAt = 0;

  private handleScroll(): void {
    if (!this.active() || this.prefersReducedMotion()) return;
    const now = performance.now();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const dt = Math.max(1, now - (this.lastScrollAt || now));
    const velocity = Math.min(1, Math.abs(scrollY - this.lastScrollY) / dt);
    this.lastScrollY = scrollY;
    this.lastScrollAt = now;

    // Keep the section dissolve in step with the scroll instead of the slow base tick.
    if (
      now - this.lastBaseRenderAt > SCROLL_BASE_REFRESH_MS &&
      Math.abs(this.computeSectionPos() - this.sectionPos) > 0.01
    ) {
      this.renderBaseLayer();
    }

    const scrollHeight = Math.max(
      1,
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    const progress = Math.max(0, Math.min(1, scrollY / scrollHeight));
    const bandRow = Math.round(progress * this.rows);
    const bandHeight = 1 + Math.round(velocity * 3);

    for (let dr = -bandHeight; dr <= bandHeight; dr++) {
      const r = bandRow + dr;
      if (r < 0 || r >= this.rows) continue;
      const rowFalloff = 1 - Math.abs(dr) / (bandHeight + 1);
      for (let c = 0; c < this.cols; c++) {
        const key = r * this.cols + c;
        const intensity = Math.max(0.25, velocity) * rowFalloff;
        this.heat.set(key, Math.max(this.heat.get(key) ?? 0, intensity));
      }
    }
    this.lastActivityAt = now;
    this.startRaf();
  }

  private rafRunning(): boolean {
    return this.rafId !== 0;
  }

  private startRaf(): void {
    if (this.rafRunning() || !this.isBrowser || this.disposed || !this.active()) return;
    this.ngZone.runOutsideAngular(() => {
      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.frameLoop(t));
    });
  }

  private stopRaf(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private stopBaseInterval(): void {
    if (this.baseIntervalId !== undefined) {
      clearInterval(this.baseIntervalId);
      this.baseIntervalId = undefined;
    }
  }

  private frameLoop(now: number): void {
    if (this.disposed || !this.active()) {
      this.rafId = 0;
      return;
    }

    const elapsed = now - this.lastFrameTime;
    if (this.isLowPower && elapsed < LOW_POWER_FRAME_MS) {
      this.rafId = requestAnimationFrame((t) => this.frameLoop(t));
      return;
    }

    this.decayHeat(elapsed);
    this.drawFrame();
    this.lastFrameTime = now;

    const idleFor = now - this.lastActivityAt;
    const stillDecaying = this.heat.size > 0;
    if (!stillDecaying && idleFor > HEAT_DECAY_MS) {
      this.rafId = 0;
      return;
    }
    this.rafId = requestAnimationFrame((t) => this.frameLoop(t));
  }

  private decayHeat(elapsedMs: number): void {
    const decay = Math.exp(-elapsedMs / HEAT_DECAY_MS);
    for (const [key, value] of this.heat) {
      const next = value * decay;
      if (next < HEAT_EPSILON) {
        this.heat.delete(key);
      } else {
        this.heat.set(key, next);
      }
    }
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    const offscreen = this.offscreen;
    if (!ctx || !offscreen) return;

    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.drawImage(offscreen, 0, 0, this.cssWidth, this.cssHeight);

    if (this.heat.size === 0) return;

    ctx.font = `${CELL_SIZE - 2}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';

    const buckets = this.litBuckets;
    for (const bucket of buckets) bucket.length = 0;
    for (const [key, value] of this.heat) {
      const themeIndex = this.themeIndexForCell(key);
      const level = Math.min(LIT_ALPHA_LEVELS - 1, Math.floor(value * LIT_ALPHA_LEVELS));
      buckets[themeIndex * LIT_ALPHA_LEVELS + level].push(key, value);
    }

    buckets.forEach((cells, index) => {
      if (cells.length === 0) return;
      const ramp = LIT_RAMPS[Math.floor(index / LIT_ALPHA_LEVELS)];
      ctx.fillStyle = LIT_STYLES[index];
      for (let i = 0; i < cells.length; i += 2) {
        const key = cells[i];
        const rampIndex = Math.min(ramp.length - 1, Math.floor(cells[i + 1] * ramp.length));
        ctx.fillText(
          ramp[rampIndex],
          (key % this.cols) * CELL_SIZE,
          Math.floor(key / this.cols) * CELL_SIZE,
        );
      }
    });
  }

  private clearCanvas(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }

  private syncRunningState(): void {
    if (document.hidden) {
      this.stopRaf();
      this.stopBaseInterval();
    } else if (this.active()) {
      this.baseIntervalId ??= this.prefersReducedMotion()
        ? undefined
        : setInterval(() => this.tickBaseLayer(), BASE_REFRESH_MS);
      this.drawFrame();
    }
  }

  private teardown(): void {
    this.disposed = true;
    this.stopRaf();
    this.stopBaseInterval();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.reducedMotionQuery?.removeEventListener('change', this.onReducedMotionChange);
    this.heat.clear();
    this.offscreen = undefined;
    this.offscreenCtx = undefined;
    this.ctx = undefined;
  }
}
