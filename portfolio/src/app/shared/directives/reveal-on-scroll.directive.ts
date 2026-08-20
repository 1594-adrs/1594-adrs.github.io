import {
  Directive,
  ElementRef,
  Output,
  EventEmitter,
  PLATFORM_ID,
  inject,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appRevealOnScroll]',
  standalone: true,
})
export class RevealOnScrollDirective implements AfterViewInit, OnDestroy {
  private elementRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private observer: IntersectionObserver | null = null;

  @Output() revealed = new EventEmitter<void>();

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.revealed.emit();
              if (this.observer) {
                this.observer.unobserve(this.elementRef.nativeElement);
              }
            }
          });
        },
        { threshold: 0.15 },
      );

      this.observer.observe(this.elementRef.nativeElement);
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
