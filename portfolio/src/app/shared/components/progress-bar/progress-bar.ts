import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  NgZone,
  ChangeDetectorRef,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NAV_LINKS } from '../../data/portfolio.data';

interface SectionMarker {
  id: string;
  label: string;
  percent: number;
}

const SECTION_IDS = NAV_LINKS.filter((link) => !link.isButton).map((link) => link.id);
const ARROW_STEP_PX = 40;
const PAGE_STEP_RATIO = 0.9;
/** A section counts as reached once its top crosses this fraction of the viewport. */
const REACHED_VIEWPORT_RATIO = 0.35;

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-bar.html',
  styleUrls: ['./progress-bar.css'],
})
export class ProgressBar implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private track = viewChild<ElementRef<HTMLElement>>('track');

  scrollProgress = signal(0);
  roundedProgress = computed(() => Math.round(this.scrollProgress()));
  markers = signal<SectionMarker[]>([]);
  dragging = signal(false);
  /** Index of the last section whose marker the progress has reached (-1 before the first). */
  activeIndex = computed(() => {
    const progress = this.scrollProgress();
    let index = -1;
    this.markers().forEach((marker, i) => {
      if (marker.percent <= progress + 0.5) index = i;
    });
    return index;
  });

  private lastProgress = 0;
  private rafId = 0;
  private isPointerDragging = false;
  private resizeObserver?: ResizeObserver;

  private onScrollHandler = () => this.handleScroll();
  private onResizeHandler = () => this.computeMarkers();

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.computeMarkers();
    this.handleScroll();

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScrollHandler, { passive: true });
      window.addEventListener('resize', this.onResizeHandler, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.computeMarkers());
        this.resizeObserver.observe(document.body);
      }
    });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('scroll', this.onScrollHandler);
    window.removeEventListener('resize', this.onResizeHandler);
    this.resizeObserver?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.isBrowser) return;
    const target = event.target as HTMLElement;
    if (target.closest('.scroll-marker')) return;

    this.isPointerDragging = true;
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.scrollToPointer(event.clientY);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isPointerDragging) return;
    this.scrollToPointer(event.clientY);
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isPointerDragging) return;
    this.isPointerDragging = false;
    this.dragging.set(false);
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    const maxScroll = this.maxScrollTop();
    const current = this.currentScrollTop();
    let target: number | null = null;

    switch (event.key) {
      case 'ArrowUp':
        target = Math.max(0, current - ARROW_STEP_PX);
        break;
      case 'ArrowDown':
        target = Math.min(maxScroll, current + ARROW_STEP_PX);
        break;
      case 'PageUp':
        target = Math.max(0, current - window.innerHeight * PAGE_STEP_RATIO);
        break;
      case 'PageDown':
        target = Math.min(maxScroll, current + window.innerHeight * PAGE_STEP_RATIO);
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = maxScroll;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.scrollTo(target);
  }

  onMarkerClick(event: Event, id: string): void {
    event.stopPropagation();
    if (!this.isBrowser) return;
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: this.scrollBehavior(), block: 'start' });
  }

  private scrollToPointer(clientY: number): void {
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;

    const rect = trackEl.getBoundingClientRect();
    const ratio = this.clamp((clientY - rect.top) / rect.height, 0, 1);
    this.scrollTo(ratio * this.maxScrollTop(), true);
  }

  private scrollTo(top: number, instant = false): void {
    window.scrollTo({
      top,
      // 'auto' would defer to the global CSS scroll-behavior: smooth and lag behind a drag.
      behavior: instant || this.prefersReducedMotion() ? 'instant' : 'smooth',
    });
  }

  private scrollBehavior(): ScrollBehavior {
    return this.prefersReducedMotion() ? 'auto' : 'smooth';
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  private currentScrollTop(): number {
    return window.scrollY || document.documentElement.scrollTop;
  }

  private maxScrollTop(): number {
    return document.documentElement.scrollHeight - document.documentElement.clientHeight;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private computeMarkers(): void {
    const maxScroll = this.maxScrollTop();
    if (maxScroll <= 0) {
      this.markers.set([]);
      return;
    }

    const next: SectionMarker[] = [];
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top =
        el.getBoundingClientRect().top +
        window.scrollY -
        window.innerHeight * REACHED_VIEWPORT_RATIO;
      const percent = this.clamp((top / maxScroll) * 100, 0, 100);
      next.push({ id, label: id, percent });
    }
    this.markers.set(next);
    this.cdr.markForCheck();
  }

  private handleScroll(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      const scrollTop = this.currentScrollTop();
      const scrollHeight = this.maxScrollTop();

      if (scrollHeight > 0) {
        const progress = this.clamp((scrollTop / scrollHeight) * 100, 0, 100);
        if (Math.abs(progress - this.lastProgress) >= 0.5) {
          this.lastProgress = progress;
          this.scrollProgress.set(progress);
          this.cdr.markForCheck();
        }
      }
    });
  }
}
