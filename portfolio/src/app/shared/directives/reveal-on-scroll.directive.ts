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
  visible = output<void>();

  ngOnInit() {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.revealed.set(true);
            this.visible.emit();
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
}
