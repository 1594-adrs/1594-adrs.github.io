import { Component, signal, HostListener, PLATFORM_ID, Inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-eye',
  standalone: true,
  templateUrl: './eye.html',
  styleUrls: ['./eye.css']
})
export class EyeComponent implements AfterViewInit {
  @ViewChild('eye') eyeElement!: ElementRef;

  private isBrowser: boolean;
  irisTransform = signal('translate(0px, 0px)');

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    // Component initialized
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isBrowser || !this.eyeElement) return;

    const eye = this.eyeElement.nativeElement;
    const rect = eye.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;

    const angle = Math.atan2(event.clientY - eyeCenterY, event.clientX - eyeCenterX);
    const distance = Math.min(15, Math.hypot(event.clientX - eyeCenterX, event.clientY - eyeCenterY) / 20);

    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    this.irisTransform.set(`translate(${x}px, ${y}px)`);
  }
}
