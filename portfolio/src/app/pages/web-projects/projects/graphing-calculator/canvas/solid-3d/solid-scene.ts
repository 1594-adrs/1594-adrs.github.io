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
} from 'three';
import type { AxisLine } from '../../engine/solids/solid.types';

/** Normal + constant of a THREE.Plane, kept DOM/three-agnostic at the call site. */
export interface SweepClip {
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

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new Scene();
    this.scene.background = new Color(0x0d0d15);

    this.camera = new PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(4, 3, 4);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
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
    this._spherical.setFromVector3(this.camera.position);
    this._spherical.theta -= deltaX * 0.01;
    this._spherical.phi -= deltaY * 0.01;
    this._spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._spherical.phi));
    this.camera.position.setFromSpherical(this._spherical);
    this.camera.lookAt(0, 0, 0);
  }

  zoomCamera(delta: number): void {
    const dir = this.camera.position.clone().normalize();
    const dist = this.camera.position.length();
    const newDist = Math.max(2, Math.min(20, dist - delta * 0.01));
    this.camera.position.copy(dir.multiplyScalar(newDist));
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
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
  }
}
