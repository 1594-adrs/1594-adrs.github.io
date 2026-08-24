import * as THREE from 'three';

export class SolidScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mesh: THREE.Mesh | null = null;
  private wireframe: THREE.Mesh | null = null;
  private animFrameId = 0;
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d15);

    this.camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(4, 3, 4);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height);

    const ambient = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);

    const point = new THREE.PointLight(0x00ff88, 0.4);
    point.position.set(-5, 5, -5);
    this.scene.add(point);

    const grid = new THREE.GridHelper(20, 20, 0x333355, 0x1a1a2e);
    this.scene.add(grid);

    const axes = new THREE.AxesHelper(10);
    this.scene.add(axes);
  }

  updateMesh(geometry: THREE.BufferGeometry, color: string): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    if (this.wireframe) {
      this.scene.remove(this.wireframe);
      this.wireframe.geometry.dispose();
      (this.wireframe.material as THREE.Material).dispose();
    }

    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this.wireframe = new THREE.Mesh(geometry, wireMat);
    this.mesh.add(this.wireframe);
  }

  render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  rotateCamera(deltaX: number, deltaY: number): void {
    const spherical = new THREE.Spherical();
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
    cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
  }
}
