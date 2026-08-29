import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  BufferGeometry,
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
} from 'three';

export class SolidScene {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private mesh: Mesh | null = null;
  private wireframe: Mesh | null = null;
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

  updateMesh(geometry: BufferGeometry, color: string): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as Material).dispose();
    }
    if (this.wireframe) {
      this.scene.remove(this.wireframe);
      this.wireframe.geometry.dispose();
      (this.wireframe.material as Material).dispose();
    }

    const material = new MeshPhongMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.7,
      side: DoubleSide,
    });
    this.mesh = new Mesh(geometry, material);
    this.scene.add(this.mesh);

    const wireMat = new MeshBasicMaterial({
      color: new Color(color),
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this.wireframe = new Mesh(geometry, wireMat);
    this.mesh.add(this.wireframe);
  }

  render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  rotateCamera(deltaX: number, deltaY: number): void {
    const spherical = new Spherical();
    spherical.setFromVector3(this.camera.position);
    spherical.theta -= deltaX * 0.01;
    spherical.phi -= deltaY * 0.01;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    this.camera.position.setFromSpherical(spherical);
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
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as Material).dispose();
      this.mesh = null;
    }
    if (this.wireframe) {
      this.wireframe.geometry.dispose();
      (this.wireframe.material as Material).dispose();
      this.wireframe = null;
    }
    this.scene.clear();
    this.renderer.dispose();
  }
}
