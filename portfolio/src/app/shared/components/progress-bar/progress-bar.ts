import {
  Component,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  NgZone,
  ChangeDetectorRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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
  scrollProgress = signal(0);

  private lastProgress = 0;
  private rafId = 0;
  private onScrollHandler = () => this.handleScroll();

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScrollHandler, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('scroll', this.onScrollHandler);
      if (this.rafId) cancelAnimationFrame(this.rafId);
    }
  }

  private handleScroll(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (scrollHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
        if (Math.abs(progress - this.lastProgress) >= 1) {
          this.lastProgress = progress;
          this.scrollProgress.set(progress);
          this.cdr.markForCheck();
        }
      }
    });
  }
}
