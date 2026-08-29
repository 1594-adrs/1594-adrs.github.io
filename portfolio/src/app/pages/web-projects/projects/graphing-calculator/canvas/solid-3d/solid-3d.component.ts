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
import { generateRevolutionMeshMulti } from './solid-geometry';
import type { RotationAxis } from '../../models/calculator.models';
import type { SolidRegion } from '../../engine/calculus';

@Component({
  selector: 'app-solid-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #threeCanvas
    class="solid-3d-canvas"
    tabindex="0"
    aria-label="3D solid view"
    (keydown)="onKeyDown($event)"
  ></canvas>`,
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

  functions = input<Array<(x: number) => number>>([]);
  regions = input<SolidRegion[]>([]);
  axis = input<RotationAxis>({ type: 'x', value: 0 });
  color = input('#00ff88');
  visible = input(false);

  private scene: SolidScene | null = null;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging || !this.scene) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.scene.rotateCamera(dx, dy);
    this.scene.render();
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };
  private onMouseUp = () => {
    this.isDragging = false;
  };
  private onMouseLeave = () => {
    this.isDragging = false;
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.scene?.zoomCamera(e.deltaY);
    this.scene?.render();
  };

  constructor() {
    this.ngZone.runOutsideAngular(() => {
      effect(() => {
        const _fns = this.functions();
        const _regions = this.regions();
        const _axis = this.axis();
        const _color = this.color();
        this.updateGeometry();
      });
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

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.ngZone.runOutsideAngular(() => {
      this.updateGeometry();
      this.scene?.render();
    });
  }

  private updateGeometry(): void {
    if (!this.scene) return;
    const fns = this.functions();
    const regs = this.regions();
    if (fns.length === 0 || regs.length === 0) return;
    const geo = generateRevolutionMeshMulti(fns, regs, this.axis());
    this.scene.updateMesh(geo, this.color());
    this.scene.render();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.removeEventListener('mousedown', this.onMouseDown);
      canvas.removeEventListener('mousemove', this.onMouseMove);
      canvas.removeEventListener('mouseup', this.onMouseUp);
      canvas.removeEventListener('mouseleave', this.onMouseLeave);
      canvas.removeEventListener('wheel', this.onWheel);
    }
    this.scene?.dispose();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.scene) return;
    switch (event.key) {
      case '+':
      case '=':
        this.scene.zoomCamera(-50);
        break;
      case '-':
      case '_':
        this.scene.zoomCamera(50);
        break;
      case 'ArrowLeft':
        this.scene.rotateCamera(-20, 0);
        break;
      case 'ArrowRight':
        this.scene.rotateCamera(20, 0);
        break;
      case 'ArrowUp':
        this.scene.rotateCamera(0, 20);
        break;
      case 'ArrowDown':
        this.scene.rotateCamera(0, -20);
        break;
      default:
        return;
    }
    event.preventDefault();
    this.scene.render();
  }
}
