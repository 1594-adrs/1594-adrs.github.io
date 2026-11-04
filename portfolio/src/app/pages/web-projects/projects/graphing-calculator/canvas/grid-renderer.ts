import { Viewport } from './viewport';
import { canvasPalette } from './palette';

/** Minor gridlines subdivide each major step this many times; skipped once that would
 *  pack them closer than MIN_MINOR_SPACING_PX on screen (clutter, not signal). */
const MINOR_SUBDIVISIONS = 5;
const MIN_MINOR_SPACING_PX = 8;
/** Hard cap on lines/labels per axis pass, so no viewport can stall the render loop. */
const MAX_GRID_LINES = 500;
/** Minimum free space between two x labels, in px. */
const LABEL_GAP_PX = 8;

function niceStep(range: number): number {
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  if (norm <= 1.5) return pow;
  if (norm <= 3.5) return 2 * pow;
  if (norm <= 7.5) return 5 * pow;
  return 10 * pow;
}

/** As many decimals as the step needs (a 1-2-5 step has one significant digit), so labels stay
 *  distinct at any zoom or offset; Number() drops the trailing zeros. */
function gridLabel(v: number, step: number): string {
  return Number(v.toFixed(Math.min(100, Math.max(0, -Math.floor(Math.log10(step)))))).toString();
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
  for (let x = start, n = 0; x <= viewport.xMax && n < MAX_GRID_LINES; x += step, n++) {
    if (x + step === x) break;
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
  for (let y = start, n = 0; y <= viewport.yMax && n < MAX_GRID_LINES; y += step, n++) {
    if (y + step === y) break;
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
  const palette = canvasPalette();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const startX = Math.ceil(viewport.xMin / stepX) * stepX;
  const startY = Math.ceil(viewport.yMin / stepY) * stepY;

  // Minor gridlines first (so the major grid + axis draw on top), one batched path per
  // axis instead of a beginPath/stroke per line.
  const minorStepX = stepX / MINOR_SUBDIVISIONS;
  const minorPxX = (minorStepX / xRange) * width;
  if (minorPxX >= MIN_MINOR_SPACING_PX) {
    const minorStartX = Math.ceil(viewport.xMin / minorStepX) * minorStepX;
    drawVerticalLines(ctx, viewport, width, height, minorStartX, minorStepX, palette.gridMinor, 1);
  }
  const minorStepY = stepY / MINOR_SUBDIVISIONS;
  const minorPxY = (minorStepY / yRange) * height;
  if (minorPxY >= MIN_MINOR_SPACING_PX) {
    const minorStartY = Math.ceil(viewport.yMin / minorStepY) * minorStepY;
    drawHorizontalLines(
      ctx,
      viewport,
      width,
      height,
      minorStartY,
      minorStepY,
      palette.gridMinor,
      1,
    );
  }

  // Major gridlines, each axis batched into a single path/stroke call.
  drawVerticalLines(ctx, viewport, width, height, startX, stepX, palette.grid, 1);
  drawHorizontalLines(ctx, viewport, width, height, startY, stepY, palette.grid, 1);

  const [ox, oy] = viewport.worldToScreen(0, 0, width, height);
  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = palette.axisWidth;

  // An off-screen axis is drawn 1 px past the edge (invisible) instead of at a huge px coordinate.
  const axisX = Math.min(width + 1, Math.max(-1, ox));
  const axisY = Math.min(height + 1, Math.max(-1, oy));
  ctx.beginPath();
  ctx.moveTo(0, axisY);
  ctx.lineTo(width, axisY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, height);
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

  ctx.fillStyle = palette.tickLabel;
  ctx.font = palette.tickFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = xBaseline;

  // Long labels (x = 1e12 on a phone) would overlap: skip one that would touch the last one drawn.
  let lastRight = -Infinity;
  for (let x = startX, n = 0; x <= viewport.xMax && n < MAX_GRID_LINES; x += stepX, n++) {
    if (x + stepX === x) break;
    if (Math.abs(x) < stepX * 0.01) continue;
    const [sx] = viewport.worldToScreen(x, 0, width, height);
    const label = gridLabel(x, stepX);
    const half = ctx.measureText(label).width / 2;
    if (sx - half < lastRight + LABEL_GAP_PX) continue;
    ctx.fillText(label, sx, labelY);
    lastRight = sx + half;
  }

  ctx.textAlign = yAlign;
  ctx.textBaseline = 'middle';
  for (let y = startY, n = 0; y <= viewport.yMax && n < MAX_GRID_LINES; y += stepY, n++) {
    if (y + stepY === y) break;
    if (Math.abs(y) < stepY * 0.01) continue;
    const [, sy] = viewport.worldToScreen(0, y, width, height);
    const label = gridLabel(y, stepY);
    ctx.fillText(label, labelX, sy);
  }
}

/** Angle k·π/12 as a reduced multiple of π: 0, π/6, π/4, 2π/3, π, 7π/4... */
export function piFractionLabel(k: number): string {
  if (k === 0) return '0';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(k, 12);
  const num = k / g;
  const den = 12 / g;
  const top = num === 1 ? 'π' : `${num}π`;
  return den === 1 ? top : `${top}/${den}`;
}

/** Polar mesh: circles around the pole and rays every π/6 and π/4, labelled in multiples of π. */
export function drawPolarGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
): void {
  const xRange = viewport.xMax - viewport.xMin;
  const yRange = viewport.yMax - viewport.yMin;
  const step = niceStep(Math.max(xRange, yRange));
  const palette = canvasPalette();
  const pxX = width / xRange;
  const pxY = height / yRange;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const [ox, oy] = viewport.worldToScreen(0, 0, width, height);
  const corners = [
    [viewport.xMin, viewport.yMin],
    [viewport.xMin, viewport.yMax],
    [viewport.xMax, viewport.yMin],
    [viewport.xMax, viewport.yMax],
  ];
  const rMax = Math.max(...corners.map(([x, y]) => Math.hypot(x, y)));
  const xIn = viewport.xMin <= 0 && viewport.xMax >= 0;
  const yIn = viewport.yMin <= 0 && viewport.yMax >= 0;
  const rMin = Math.hypot(
    xIn ? 0 : Math.min(Math.abs(viewport.xMin), Math.abs(viewport.xMax)),
    yIn ? 0 : Math.min(Math.abs(viewport.yMin), Math.abs(viewport.yMax)),
  );

  const circles = (s: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const first = Math.max(1, Math.floor(rMin / s));
    for (let k = first, n = 0; k * s <= rMax && n < MAX_GRID_LINES; k++, n++) {
      const r = k * s;
      ctx.moveTo(ox + r * pxX, oy);
      ctx.ellipse(ox, oy, r * pxX, r * pxY, 0, 0, 2 * Math.PI);
    }
    ctx.stroke();
  };
  if ((step / 2) * Math.min(pxX, pxY) >= MIN_MINOR_SPACING_PX) circles(step / 2, palette.gridMinor);
  circles(step, palette.grid);

  const rays = [...Array(24).keys()].filter((k) => k % 2 === 0 || k % 3 === 0);
  ctx.strokeStyle = palette.grid;
  ctx.beginPath();
  for (const k of rays) {
    if (k % 6 === 0) continue;
    const a = (k * Math.PI) / 12;
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + rMax * Math.cos(a) * pxX, oy - rMax * Math.sin(a) * pxY);
  }
  ctx.stroke();

  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = palette.axisWidth;
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(width, oy);
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, height);
  ctx.stroke();

  ctx.fillStyle = palette.tickLabel;
  ctx.font = palette.tickFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let k = 1, n = 0; k * step <= viewport.xMax && n < MAX_GRID_LINES; k++, n++) {
    ctx.fillText(gridLabel(k * step, step), ox + k * step * pxX, oy + 4);
  }

  if (ox < 0 || ox > width || oy < 0 || oy > height) return;
  ctx.textBaseline = 'middle';
  for (const k of rays) {
    const a = (k * Math.PI) / 12;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    const exit = (o: number, d: number, size: number) =>
      d > 1e-9 ? (size - o) / d : d < -1e-9 ? -o / d : Infinity;
    const dist = Math.min(exit(ox, dx, width), exit(oy, dy, height)) - 24;
    if (dist < 40) continue;
    const label = piFractionLabel(k);
    const tx = ox + dist * dx;
    const ty = oy + dist * dy;
    const w = ctx.measureText(label).width + 6;
    ctx.fillStyle = palette.background;
    ctx.fillRect(tx - w / 2, ty - 8, w, 16);
    ctx.fillStyle = palette.tickLabel;
    ctx.fillText(label, tx, ty);
  }
}
