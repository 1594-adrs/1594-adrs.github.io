import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
  input,
  effect,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { SolidScene } from './solid-scene';
import { generateRevolutionMesh } from './solid-geometry';
import type { RotationAxis } from '../../models/calculator.models';

@Component({
  selector: 'app-solid-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #threeCanvas class="solid-3d-canvas"></canvas>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .solid-3d-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class Solid3DComponent implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ngZone = inject(NgZone);

  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('threeCanvas');

  fn = input<((x: number) => number) | null>(null);
  a = input(0);
  b = input(3);
  axis = input<RotationAxis>({ type: 'x', value: 0 });
  color = input('#00ff88');
  visible = input(false);

  private scene: SolidScene | null = null;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const _ = this.fn();
      const _a = this.a();
      const _b = this.b();
      const _axis = this.axis();
      const _color = this.color();
      this.updateGeometry();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    this.scene = new SolidScene(canvas);

    if (parent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!canvas || !parent || !this.scene) return;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        this.scene.resize(canvas.width, canvas.height);
        this.scene.render();
      });
      this.resizeObserver.observe(parent);
    }

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging || !this.scene) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.scene.rotateCamera(dx, dy);
      this.scene.render();
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });
    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        this.scene?.zoomCamera(e.deltaY);
        this.scene?.render();
      },
      { passive: false },
    );

    this.ngZone.runOutsideAngular(() => {
      this.updateGeometry();
      this.scene?.render();
    });
  }

  private updateGeometry(): void {
    if (!this.scene || !this.fn()) return;
    const geo = generateRevolutionMesh(this.fn()!, this.a(), this.b(), this.axis());
    this.scene.updateMesh(geo, this.color());
    this.scene.render();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.scene?.dispose();
  }
}
