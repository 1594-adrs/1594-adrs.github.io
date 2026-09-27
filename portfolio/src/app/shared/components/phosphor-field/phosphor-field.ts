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

/** Density ramp, dimmest to brightest. Index 0 renders nothing. */
const RAMP = ' .:-+*#%@';
const CELL_SIZE = 16;
const BASE_MIN_ALPHA = 0.06;
const BASE_MAX_ALPHA = 0.12;
const LIT_MAX_ALPHA = 0.5;
const HEAT_DECAY_MS = 550;
const HEAT_EPSILON = 0.02;
const BASE_REFRESH_MS = 200;
const LOW_POWER_FRAME_MS = 1000 / 30;
const SECTION_IDS = ['home', 'about', 'experience', 'projects'];
const COLOR_GREEN: [number, number, number] = [0, 255, 136];
const COLOR_CYAN: [number, number, number] = [0, 204, 255];

interface SectionAnchor {
  top: number;
  colorT: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp(a[0], b[0], clamped));
  const g = Math.round(lerp(a[1], b[1], clamped));
  const bl = Math.round(lerp(a[2], b[2], clamped));
  return `${r}, ${g}, ${bl}`;
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
  private currentColorT = 0;

  private noiseTime = 0;
  private lastBaseRefresh = 0;
  private lastFrameTime = 0;
  private rafId = 0;
  private baseIntervalId?: ReturnType<typeof setInterval>;
  private lastActivityAt = 0;
  private disposed = false;

  private onResize = () => this.setupCanvas();
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
    this.readSectionAnchors();
    this.renderBaseLayer();
    this.drawFrame();

    this.stopBaseInterval();
    if (this.prefersReducedMotion()) {
      return;
    }
    this.baseIntervalId = setInterval(() => this.tickBaseLayer(), BASE_REFRESH_MS);
  }

  private readSectionAnchors(): void {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const anchors: SectionAnchor[] = [];
    SECTION_IDS.forEach((id, index) => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + scrollY;
      const colorT = index <= 1 ? 0 : 1;
      anchors.push({ top, colorT });
    });
    this.sections = anchors.sort((a, b) => a.top - b.top);
  }

  private computeSectionColorT(): number {
    if (this.sections.length < 2) return 0;
    const viewportCenter =
      (window.scrollY || document.documentElement.scrollTop) + this.cssHeight / 2;

    let prev = this.sections[0];
    for (let i = 1; i < this.sections.length; i++) {
      const next = this.sections[i];
      if (viewportCenter <= next.top) {
        const span = next.top - prev.top || 1;
        const t = (viewportCenter - prev.top) / span;
        return lerp(prev.colorT, next.colorT, Math.max(0, Math.min(1, t)));
      }
      prev = next;
    }
    return prev.colorT;
  }

  private tickBaseLayer(): void {
    if (!this.active()) return;
    this.noiseTime += BASE_REFRESH_MS / 1000;
    this.renderBaseLayer();
    if (!this.rafRunning()) {
      this.drawFrame();
    }
  }

  private renderBaseLayer(): void {
    const ctx = this.offscreenCtx;
    if (!ctx) return;
    this.currentColorT = this.computeSectionColorT();
    const rgb = lerpColor(COLOR_GREEN, COLOR_CYAN, this.currentColorT);

    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const value = fieldNoise(col, row, this.noiseTime);
        const rampIndex = Math.min(RAMP.length - 1, Math.floor(value * RAMP.length));
        if (rampIndex === 0) continue;
        const alpha = BASE_MIN_ALPHA + value * (BASE_MAX_ALPHA - BASE_MIN_ALPHA);
        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.fillText(RAMP[rampIndex], col * CELL_SIZE, row * CELL_SIZE);
      }
    }
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

    const rgb = lerpColor(COLOR_GREEN, COLOR_CYAN, this.currentColorT);
    ctx.font = `${CELL_SIZE - 2}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';

    for (const [key, value] of this.heat) {
      const row = Math.floor(key / this.cols);
      const col = key % this.cols;
      const rampIndex = Math.min(RAMP.length - 1, Math.max(1, Math.floor(value * RAMP.length)));
      const alpha = Math.min(LIT_MAX_ALPHA, value * LIT_MAX_ALPHA + 0.05);
      ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
      ctx.fillText(RAMP[rampIndex], col * CELL_SIZE, row * CELL_SIZE);
    }
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
