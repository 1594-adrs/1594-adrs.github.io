export class Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;

  constructor(xMin = -10, xMax = 10, yMin = -7, yMax = 7) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
  }

  worldToScreen(wx: number, wy: number, width: number, height: number): [number, number] {
    const sx = ((wx - this.xMin) / (this.xMax - this.xMin)) * width;
    const sy = height - ((wy - this.yMin) / (this.yMax - this.yMin)) * height;
    return [sx, sy];
  }

  screenToWorld(sx: number, sy: number, width: number, height: number): [number, number] {
    const wx = this.xMin + (sx / width) * (this.xMax - this.xMin);
    const wy = this.yMax - (sy / height) * (this.yMax - this.yMin);
    return [wx, wy];
  }

  zoom(factor: number, centerX: number, centerY: number, width: number, height: number): void {
    const [wx, wy] = this.screenToWorld(centerX, centerY, width, height);
    let newW = (this.xMax - this.xMin) / factor;
    let newH = (this.yMax - this.yMin) / factor;
    newW = Math.max(1e-10, Math.min(1e15, newW));
    newH = Math.max(1e-10, Math.min(1e15, newH));
    this.xMin = wx - (centerX / width) * newW;
    this.xMax = this.xMin + newW;
    this.yMin = wy - ((height - centerY) / height) * newH;
    this.yMax = this.yMin + newH;
  }

  pan(dx: number, dy: number, width: number, height: number): void {
    const worldDx = (dx / width) * (this.xMax - this.xMin);
    const worldDy = (dy / height) * (this.yMax - this.yMin);
    this.xMin -= worldDx;
    this.xMax -= worldDx;
    this.yMin += worldDy;
    this.yMax += worldDy;
  }

  reset(): void {
    this.xMin = -10;
    this.xMax = 10;
    this.yMin = -7;
    this.yMax = 7;
  }
}
