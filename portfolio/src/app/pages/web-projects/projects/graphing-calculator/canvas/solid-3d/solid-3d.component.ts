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
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SolidScene } from './solid-scene';
import { generateRevolutionMeshMulti } from './solid-geometry';
import { buildSolidGeometry } from './solid-mesh-builder';
import { buildSliceGeometry } from './slice-geometry';
import type { RotationAxis } from '../../models/calculator.models';
import type { SolidRegion } from '../../engine/calculus';
import type { SolidPiece, SolidSpec } from '../../engine/solids/solid.types';

const SLICE_HIGHLIGHT_COLOR = '#ffcc00';

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

  /** Spec-driven "solids by integration" inputs. When `spec` is non-null, these take over. */
  spec = input<SolidSpec | null>(null);
  pieces = input<SolidPiece[]>([]);
  sweepT = input<number | null>(null);

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
      // Legacy (functions/regions) pipeline — unchanged, but skipped while a spec is active.
      effect(() => {
        const _fns = this.functions();
        const _regions = this.regions();
        const _axis = this.axis();
        const _color = this.color();
        if (this.spec()) return;
        this.scene?.clearSpecMesh();
        this.updateGeometry();
      });

      // Spec-driven mesh rebuild — only on spec/pieces change (color handled separately below).
      effect(() => {
        const spec = this.spec();
        const pieces = this.pieces();
        if (!spec) {
          this.scene?.clearSpecMesh();
          return;
        }
        this.scene?.clearLegacyMesh();
        this.rebuildSolidMesh(spec, pieces);
      });

      // Spec-driven color updates, independent of geometry rebuilds.
      effect(() => {
        const spec = this.spec();
        const color = this.color();
        if (spec) this.scene?.setSolidColor(color);
      });

      // Sweep clipping + representative slice — independent of the geometry rebuild above.
      effect(() => {
        const spec = this.spec();
        const pieces = this.pieces();
        const t = this.sweepT();
        this.updateSweep(spec, pieces, t);
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
      const spec = this.spec();
      if (spec) {
        this.scene?.clearLegacyMesh();
        this.rebuildSolidMesh(spec, this.pieces());
      } else {
        this.updateGeometry();
      }
      this.updateSweep(spec, this.pieces(), this.sweepT());
      this.scene?.render();
    });
  }

  private updateGeometry(): void {
    if (!this.scene) return;
    const fns = this.functions();
    const regs = this.regions();
    if (fns.length === 0 || regs.length === 0) return;
    const meshes = generateRevolutionMeshMulti(fns, regs, this.axis());
    this.scene.updateMesh(meshes, this.color());
    this.scene.render();
  }

  private rebuildSolidMesh(spec: SolidSpec, pieces: SolidPiece[]): void {
    if (!this.scene) return;
    const geometries = buildSolidGeometry(spec, pieces);
    this.scene.updateSolidPieces(geometries, this.color());
    this.scene.updateAxisLine(spec.axis ?? null);
    this.scene.render();
  }

  private updateSweep(spec: SolidSpec | null, pieces: SolidPiece[], t: number | null): void {
    if (!this.scene) return;
    if (!spec || t === null || !Number.isFinite(t)) {
      this.scene.setSweepClip(null);
      this.scene.updateSliceMesh(null, SLICE_HIGHLIGHT_COLOR);
      this.scene.render();
      return;
    }
    const normal: [number, number, number] = spec.variable === 'x' ? [-1, 0, 0] : [0, -1, 0];
    this.scene.setSweepClip({ normal, constant: t });
    const sliceGeometry = buildSliceGeometry(spec, pieces, t);
    this.scene.updateSliceMesh(sliceGeometry, SLICE_HIGHLIGHT_COLOR);
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
