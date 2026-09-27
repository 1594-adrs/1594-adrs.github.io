import {
  Directive,
  signal,
  output,
  input,
  ElementRef,
  inject,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appRevealOnScroll]',
  exportAs: 'reveal',
})
export class RevealOnScroll implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private ngZone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer?: IntersectionObserver;
  private hideTimerId: ReturnType<typeof setTimeout> | null = null;

  threshold = input(0.15);
  revealed = signal(false);
  hiding = signal(false);
  visible = output<void>();

  ngOnInit() {
    if (!this.isBrowser) return;

    // Only hide content before reveal when JS can actually run the reveal;
    // otherwise (no-JS, prerendered HTML) sections must render visible.
    document.documentElement.classList.add('js-reveal');

    if (this.prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      this.revealed.set(true);
      this.visible.emit();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.hiding.set(false);
            this.revealed.set(true);
            this.visible.emit();
          } else if (this.revealed()) {
            this.hiding.set(true);
            this.hideTimerId = setTimeout(() => {
              this.ngZone.run(() => {
                this.hiding.set(false);
                this.revealed.set(false);
              });
            }, 400);
          }
        });
      },
      { threshold: this.threshold() },
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    if (this.hideTimerId !== null) clearTimeout(this.hideTimerId);
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }
}
