import { Viewport } from './viewport';

// Canvas 2D context does not support CSS variables; colors are hardcoded intentionally.
const COLOR_BG = '#0d0d15';
const COLOR_GRID = '#1a1a2e';
const COLOR_MINOR_GRID = '#131320';
const COLOR_AXIS = '#333355';
const COLOR_LABEL = '#666680';

const LABEL_FONT = '11px "JetBrains Mono", monospace';
/** Minor gridlines subdivide each major step this many times; skipped once that would
 *  pack them closer than MIN_MINOR_SPACING_PX on screen (clutter, not signal). */
const MINOR_SUBDIVISIONS = 5;
const MIN_MINOR_SPACING_PX = 8;

function niceStep(range: number): number {
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  if (norm <= 1.5) return pow;
  if (norm <= 3.5) return 2 * pow;
  if (norm <= 7.5) return 5 * pow;
  return 10 * pow;
}

function drawVerticalLines(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  start: number,
  step: number,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let x = start; x <= viewport.xMax; x += step) {
    const [sx] = viewport.worldToScreen(x, 0, width, height);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
  }
  ctx.stroke();
}

function drawHorizontalLines(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  start: number,
  step: number,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let y = start; y <= viewport.yMax; y += step) {
    const [, sy] = viewport.worldToScreen(0, y, width, height);
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
  }
  ctx.stroke();
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

  const startX = Math.ceil(viewport.xMin / stepX) * stepX;
  const startY = Math.ceil(viewport.yMin / stepY) * stepY;

  // Minor gridlines first (so the major grid + axis draw on top), one batched path per
  // axis instead of a beginPath/stroke per line.
  const minorStepX = stepX / MINOR_SUBDIVISIONS;
  const minorPxX = (minorStepX / xRange) * width;
  if (minorPxX >= MIN_MINOR_SPACING_PX) {
    const minorStartX = Math.ceil(viewport.xMin / minorStepX) * minorStepX;
    drawVerticalLines(ctx, viewport, width, height, minorStartX, minorStepX, COLOR_MINOR_GRID, 1);
  }
  const minorStepY = stepY / MINOR_SUBDIVISIONS;
  const minorPxY = (minorStepY / yRange) * height;
  if (minorPxY >= MIN_MINOR_SPACING_PX) {
    const minorStartY = Math.ceil(viewport.yMin / minorStepY) * minorStepY;
    drawHorizontalLines(ctx, viewport, width, height, minorStartY, minorStepY, COLOR_MINOR_GRID, 1);
  }

  // Major gridlines, each axis batched into a single path/stroke call.
  drawVerticalLines(ctx, viewport, width, height, startX, stepX, COLOR_GRID, 1);
  drawHorizontalLines(ctx, viewport, width, height, startY, stepY, COLOR_GRID, 1);

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

  // When an axis line is scrolled off-screen, pin its tick labels to the nearest
  // visible edge (Desmos-style) instead of drawing them off-canvas where they're
  // invisible.
  let labelY: number;
  let xBaseline: CanvasTextBaseline;
  if (oy < 0) {
    labelY = 2;
    xBaseline = 'top';
  } else if (oy > height) {
    labelY = height - 2;
    xBaseline = 'bottom';
  } else {
    labelY = oy + 4;
    xBaseline = 'top';
  }

  let labelX: number;
  let yAlign: CanvasTextAlign;
  if (ox < 0) {
    labelX = 4;
    yAlign = 'left';
  } else if (ox > width) {
    labelX = width - 4;
    yAlign = 'right';
  } else {
    labelX = ox - 6;
    yAlign = 'right';
  }

  ctx.fillStyle = COLOR_LABEL;
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = xBaseline;

  for (let x = startX; x <= viewport.xMax; x += stepX) {
    if (Math.abs(x) < stepX * 0.01) continue;
    const [sx] = viewport.worldToScreen(x, 0, width, height);
    const label = Math.abs(x) < 0.001 ? '0' : Number(x.toPrecision(4)).toString();
    ctx.fillText(label, sx, labelY);
  }

  ctx.textAlign = yAlign;
  ctx.textBaseline = 'middle';
  for (let y = startY; y <= viewport.yMax; y += stepY) {
    if (Math.abs(y) < stepY * 0.01) continue;
    const [, sy] = viewport.worldToScreen(0, y, width, height);
    const label = Math.abs(y) < 0.001 ? '0' : Number(y.toPrecision(4)).toString();
    ctx.fillText(label, labelX, sy);
  }
}
