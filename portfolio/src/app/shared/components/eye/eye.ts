import {
  Component,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  ElementRef,
  viewChild,
  NgZone,
  ChangeDetectorRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-eye',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eye.html',
  styleUrls: ['./eye.css'],
})
export class Eye implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private eyeElement = viewChild<ElementRef>('eye');

  irisTransform = signal('translate(0px, 0px)');

  private lastX = 0;
  private lastY = 0;
  private onMouseMoveHandler = (event: MouseEvent) => this.handleMouseMove(event);

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onMouseMoveHandler);
    });
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('mousemove', this.onMouseMoveHandler);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const eye = this.eyeElement()?.nativeElement;
    if (!eye) return;

    const rect = eye.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;

    const angle = Math.atan2(event.clientY - eyeCenterY, event.clientX - eyeCenterX);
    const distance = Math.min(
      15,
      Math.hypot(event.clientX - eyeCenterX, event.clientY - eyeCenterY) / 20,
    );

    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    if (Math.abs(x - this.lastX) > 0.5 || Math.abs(y - this.lastY) > 0.5) {
      this.lastX = x;
      this.lastY = y;
      this.irisTransform.set(`translate(${x}px, ${y}px)`);
      this.cdr.markForCheck();
    }
  }
}
