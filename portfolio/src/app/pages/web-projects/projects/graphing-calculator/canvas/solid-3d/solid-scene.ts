import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  Color,
  AmbientLight,
  DirectionalLight,
  PointLight,
  GridHelper,
  AxesHelper,
  MeshPhongMaterial,
  Material,
  DoubleSide,
  Spherical,
  LineDashedMaterial,
  Line,
  Plane,
  Vector3,
  BufferGeometry,
  Box3,
  Sphere,
} from 'three';
import type { AxisLine } from '../../engine/solids/solid.types';

/** Normal + constant of a THREE.Plane, kept DOM/three-agnostic at the call site. */
interface SweepClip {
  normal: [number, number, number];
  constant: number;
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const m of material) m.dispose();
  } else {
    material.dispose();
  }
}

export class SolidScene {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private readonly grid: GridHelper;
  private readonly axes: AxesHelper;
  private isDisposed = false;

  // "solids by integration" (spec-driven) pipeline.
  private solidPieceMeshes: Mesh[] = [];
  private sliceMesh: Mesh | null = null;
  private axisLine: Line | null = null;
  private readonly clipPlane = new Plane(new Vector3(-1, 0, 0), 0);
  private clipActive = false;

  // Camera framing: orbit target, zoom limits and the radius the camera was last fitted to.
  private readonly target = new Vector3(0, 0, 0);
  private minDist = 2;
  private maxDist = 20;
  private framedRadius = 0;

  /** `createRenderer` exists so tests can run without a WebGL context. */
  constructor(
    canvas: HTMLCanvasElement,
    createRenderer: (canvas: HTMLCanvasElement) => WebGLRenderer = (c) =>
      new WebGLRenderer({ canvas: c, antialias: true }),
  ) {
    this.scene = new Scene();
    this.scene.background = new Color(0x0d0d15);

    this.camera = new PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(4, 3, 4);
    this.camera.lookAt(0, 0, 0);

    this.renderer = createRenderer(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.localClippingEnabled = true;

    const ambient = new AmbientLight(0x404040, 0.6);
    this.scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);

    const point = new PointLight(0x00ff88, 0.4);
    point.position.set(-5, 5, -5);
    this.scene.add(point);

    this.grid = new GridHelper(20, 20, 0x333355, 0x1a1a2e);
    this.scene.add(this.grid);

    this.axes = new AxesHelper(10);
    this.scene.add(this.axes);
  }

  /** Clears the spec-driven meshes (solid pieces, slice, axis line), e.g. when spec becomes null. */
  clearSpecMesh(): void {
    this.disposeSolidPieces();
    this.updateSliceMesh(null, '#ffcc00');
    this.updateAxisLine(null);
    this.frameSolid();
  }

  /** Replaces the spec-driven solid mesh with one Mesh per piece geometry. */
  updateSolidPieces(geometries: BufferGeometry[], color: string): void {
    this.disposeSolidPieces();
    const baseColor = new Color(color);
    for (const geometry of geometries) {
      const material = new MeshPhongMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.5,
        side: DoubleSide,
        clippingPlanes: this.clipActive ? [this.clipPlane] : [],
      });
      const mesh = new Mesh(geometry, material);
      this.scene.add(mesh);
      this.solidPieceMeshes.push(mesh);
    }
    this.frameSolid();
  }

  /**
   * Fits the camera to the pieces' bounding sphere (or back to the default view when there is
   * nothing to show). Keeps the viewing direction; skipped when the solid's size is within 25%
   * of the last fit, so tweaking a bound does not undo the user's zoom.
   */
  private frameSolid(): void {
    const box = new Box3();
    for (const mesh of this.solidPieceMeshes) box.expandByObject(mesh);
    const hasBounds = !box.isEmpty();
    const radius = hasBounds ? Math.max(box.getBoundingSphere(new Sphere()).radius, 0.5) : 0;
    const ratio = this.framedRadius > 0 ? radius / this.framedRadius : 0;
    if (this.framedRadius > 0 && ratio > 0.8 && ratio < 1.25) return;

    const dir = this.camera.position.clone().sub(this.target);
    if (dir.lengthSq() === 0) dir.set(4, 3, 4);
    dir.normalize();
    if (!hasBounds) {
      this.target.set(0, 0, 0);
      this.minDist = 2;
      this.maxDist = 20;
      this.framedRadius = 0;
      this.camera.position.copy(dir.multiplyScalar(Math.hypot(4, 3, 4)));
      this.camera.lookAt(this.target);
      return;
    }
    box.getCenter(this.target);
    const vFov = (this.camera.fov * Math.PI) / 180;
    const fitHalf = Math.atan(Math.tan(vFov / 2) * Math.min(1, this.camera.aspect || 1));
    const dist = (radius / Math.sin(fitHalf)) * 1.15;
    this.minDist = Math.max(0.5, dist * 0.15);
    this.maxDist = dist * 5;
    this.framedRadius = radius;
    this.camera.position.copy(this.target).addScaledVector(dir, dist);
    this.camera.lookAt(this.target);
    this.camera.far = Math.max(1000, this.maxDist * 4);
    this.camera.updateProjectionMatrix();
  }

  /** Updates the color of the existing spec-driven solid pieces without touching geometry. */
  setSolidColor(color: string): void {
    const baseColor = new Color(color);
    for (const mesh of this.solidPieceMeshes) {
      (mesh.material as MeshPhongMaterial).color.copy(baseColor);
    }
  }

  private disposeSolidPieces(): void {
    for (const mesh of this.solidPieceMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
    this.solidPieceMeshes = [];
  }

  /**
   * Sets (or clears) the sweep clipping plane used to reveal only the part of the solid already
   * swept from a to t. Updates the existing piece materials in place — no mesh regeneration.
   */
  setSweepClip(clip: SweepClip | null): void {
    this.clipActive = clip !== null;
    if (clip) {
      this.clipPlane.normal.set(clip.normal[0], clip.normal[1], clip.normal[2]);
      this.clipPlane.constant = clip.constant;
    }
    for (const mesh of this.solidPieceMeshes) {
      (mesh.material as MeshPhongMaterial).clippingPlanes = this.clipActive ? [this.clipPlane] : [];
    }
  }

  /** Shows (or hides, when geometry is null) the representative slice in a highlight color. */
  updateSliceMesh(geometry: BufferGeometry | null, color: string): void {
    if (this.sliceMesh) {
      this.scene.remove(this.sliceMesh);
      this.sliceMesh.geometry.dispose();
      (this.sliceMesh.material as Material).dispose();
      this.sliceMesh = null;
    }
    if (!geometry) return;
    const material = new MeshPhongMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
    });
    this.sliceMesh = new Mesh(geometry, material);
    this.scene.add(this.sliceMesh);
  }

  /** Draws (or clears, when axis is null) the 3D line of revolution. */
  updateAxisLine(axis: AxisLine | null): void {
    if (this.axisLine) {
      this.scene.remove(this.axisLine);
      this.axisLine.geometry.dispose();
      (this.axisLine.material as Material).dispose();
      this.axisLine = null;
    }
    if (!axis) return;

    const length = 24;
    const points =
      axis.orientation === 'horizontal'
        ? [new Vector3(-length / 2, axis.value, 0), new Vector3(length / 2, axis.value, 0)]
        : [new Vector3(axis.value, -length / 2, 0), new Vector3(axis.value, length / 2, 0)];

    const geometry = new BufferGeometry().setFromPoints(points);
    const material = new LineDashedMaterial({ color: 0xffffff, dashSize: 0.3, gapSize: 0.2 });
    const line = new Line(geometry, material);
    line.computeLineDistances();
    this.scene.add(line);
    this.axisLine = line;
  }

  render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private readonly _spherical = new Spherical();

  rotateCamera(deltaX: number, deltaY: number): void {
    this._spherical.setFromVector3(this.camera.position.clone().sub(this.target));
    this._spherical.theta -= deltaX * 0.01;
    this._spherical.phi -= deltaY * 0.01;
    this._spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._spherical.phi));
    this.camera.position.setFromSpherical(this._spherical).add(this.target);
    this.camera.lookAt(this.target);
  }

  zoomCamera(delta: number): void {
    const offset = this.camera.position.clone().sub(this.target);
    const dist = offset.length();
    // Step scales with distance so zooming feels the same for small and large solids.
    const step = delta * 0.01 * (dist / Math.hypot(4, 3, 4));
    const newDist = Math.max(this.minDist, Math.min(this.maxDist, dist - step));
    this.camera.position.copy(this.target).add(offset.normalize().multiplyScalar(newDist));
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Releases every GPU resource. `renderer.dispose()` alone frees buffers but keeps the WebGL
   * context alive until GC, and browsers cap live contexts (~16): opening/closing the 3D view
   * repeatedly made them evict older ones. `forceContextLoss()` hands the context back at once.
   */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.disposeSolidPieces();
    if (this.sliceMesh) {
      this.sliceMesh.geometry.dispose();
      (this.sliceMesh.material as Material).dispose();
      this.sliceMesh = null;
    }
    if (this.axisLine) {
      this.axisLine.geometry.dispose();
      (this.axisLine.material as Material).dispose();
      this.axisLine = null;
    }
    this.grid.geometry.dispose();
    disposeMaterial(this.grid.material);
    this.axes.geometry.dispose();
    disposeMaterial(this.axes.material);
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
