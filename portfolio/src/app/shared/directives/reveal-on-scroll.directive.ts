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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appRevealOnScroll]',
  exportAs: 'reveal',
})
export class RevealOnScroll implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer?: IntersectionObserver;

  threshold = input(0.15);
  revealed = signal(false);
  hiding = signal(false);
  visible = output<void>();

  ngOnInit() {
    if (!this.isBrowser) return;

    if (this.prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      this.reveal();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.reveal();
            this.observer?.unobserve(this.el.nativeElement);
            this.observer?.disconnect();
          }
        });
      },
      { threshold: this.threshold() },
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private reveal(): void {
    this.revealed.set(true);
    this.visible.emit();
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }
}
