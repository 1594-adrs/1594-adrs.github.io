import { Viewport } from './viewport';

// Canvas 2D context does not support CSS variables; colors are hardcoded intentionally.
const COLOR_BG = '#0d0d15';
const COLOR_GRID = '#1a1a2e';
const COLOR_AXIS = '#333355';
const COLOR_LABEL = '#666680';

function niceStep(range: number): number {
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  if (norm <= 1.5) return pow;
  if (norm <= 3.5) return 2 * pow;
  if (norm <= 7.5) return 5 * pow;
  return 10 * pow;
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
): void {
  const xRange = viewport.xMax - viewport.xMin;
  const yRange = viewport.yMax - viewport.yMin;
  const stepX = niceStep(xRange);
  const stepY = niceStep(yRange);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 1;

  const startX = Math.ceil(viewport.xMin / stepX) * stepX;
  for (let x = startX; x <= viewport.xMax; x += stepX) {
    const [sx] = viewport.worldToScreen(x, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
  }

  const startY = Math.ceil(viewport.yMin / stepY) * stepY;
  for (let y = startY; y <= viewport.yMax; y += stepY) {
    const [, sy] = viewport.worldToScreen(0, y, width, height);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
  }

  const [ox, oy] = viewport.worldToScreen(0, 0, width, height);
  ctx.strokeStyle = COLOR_AXIS;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(width, oy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, height);
  ctx.stroke();

  ctx.fillStyle = COLOR_LABEL;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let x = startX; x <= viewport.xMax; x += stepX) {
    if (Math.abs(x) < stepX * 0.01) continue;
    const [sx] = viewport.worldToScreen(x, 0, width, height);
    const label = Math.abs(x) < 0.001 ? '0' : Number(x.toPrecision(4)).toString();
    ctx.fillText(label, sx, oy + 4);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = startY; y <= viewport.yMax; y += stepY) {
    if (Math.abs(y) < stepY * 0.01) continue;
    const [, sy] = viewport.worldToScreen(0, y, width, height);
    const label = Math.abs(y) < 0.001 ? '0' : Number(y.toPrecision(4)).toString();
    ctx.fillText(label, ox - 6, sy);
  }
}
