import {
  Component,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  ElementRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-eye',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:mousemove)': 'onMouseMove($event)',
  },
  templateUrl: './eye.html',
  styleUrls: ['./eye.css'],
})
export class Eye {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eyeElement = viewChild.required<ElementRef>('eye');

  irisTransform = signal('translate(0px, 0px)');

  onMouseMove(event: MouseEvent) {
    if (!this.isBrowser) return;

    const eye = this.eyeElement().nativeElement;
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

    this.irisTransform.set(`translate(${x}px, ${y}px)`);
  }
}
