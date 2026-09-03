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
  MeshBasicMaterial,
  Material,
  DoubleSide,
  Spherical,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
} from 'three';
import type { SolidMeshes } from './solid-geometry';

export class SolidScene {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private outerMesh: Mesh | null = null;
  private innerMesh: Mesh | null = null;
  private innerWire: Mesh | null = null;
  private capMesh: Mesh | null = null;
  private edgeLines: LineSegments | null = null;
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new Scene();
    this.scene.background = new Color(0x0d0d15);

    this.camera = new PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(4, 3, 4);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height);

    const ambient = new AmbientLight(0x404040, 0.6);
    this.scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);

    const point = new PointLight(0x00ff88, 0.4);
    point.position.set(-5, 5, -5);
    this.scene.add(point);

    const grid = new GridHelper(20, 20, 0x333355, 0x1a1a2e);
    this.scene.add(grid);

    const axes = new AxesHelper(10);
    this.scene.add(axes);
  }

  updateMesh(meshes: SolidMeshes, color: string): void {
    this.disposeMeshes();

    const baseColor = new Color(color);
    const darkerColor = baseColor.clone().multiplyScalar(0.55);

    this.outerMesh = new Mesh(
      meshes.outer,
      new MeshPhongMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.45,
        side: DoubleSide,
      }),
    );
    this.scene.add(this.outerMesh);

    if (meshes.inner) {
      this.innerMesh = new Mesh(
        meshes.inner,
        new MeshPhongMaterial({
          color: darkerColor,
          transparent: true,
          opacity: 0.65,
          side: DoubleSide,
        }),
      );
      this.scene.add(this.innerMesh);

      this.innerWire = new Mesh(
        meshes.inner,
        new MeshBasicMaterial({
          color: darkerColor,
          wireframe: true,
          transparent: true,
          opacity: 0.15,
        }),
      );
      this.scene.add(this.innerWire);
    }

    this.capMesh = new Mesh(
      meshes.caps,
      new MeshPhongMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.55,
        side: DoubleSide,
      }),
    );
    this.scene.add(this.capMesh);

    const edges = new EdgesGeometry(meshes.caps, 15);
    this.edgeLines = new LineSegments(
      edges,
      new LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.scene.add(this.edgeLines);
  }

  private disposeMeshes(): void {
    const fields = [this.outerMesh, this.innerMesh, this.innerWire, this.capMesh] as (Mesh | null)[];
    for (const m of fields) {
      if (m) {
        this.scene.remove(m);
        m.geometry.dispose();
        (m.material as Material).dispose();
      }
    }
    if (this.edgeLines) {
      this.scene.remove(this.edgeLines);
      this.edgeLines.geometry.dispose();
      (this.edgeLines.material as Material).dispose();
    }
    this.outerMesh = null;
    this.innerMesh = null;
    this.innerWire = null;
    this.capMesh = null;
    this.edgeLines = null;
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
    this.disposeMeshes();
    this.scene.clear();
    this.renderer.dispose();
  }
}
