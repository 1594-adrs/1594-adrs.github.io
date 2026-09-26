import { Viewport } from './viewport';
import type { ConicInfo } from '../engine/conic-detector';

/** Point count for the parametric sweep of a recognized conic — smooth at any
 *  zoom level while staying orders of magnitude cheaper than the marching-
 *  squares grid it replaces (~150k-250k evaluations/frame for a generic
 *  implicit curve). */
const SAMPLE_POINTS = 300;

function strokePoints(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  points: ReadonlyArray<readonly [number, number] | null>,
): void {
  ctx.beginPath();
  let drawing = false;
  for (const p of points) {
    if (!p || !isFinite(p[0]) || !isFinite(p[1])) {
      drawing = false;
      continue;
    }
    const [sx, sy] = viewport.worldToScreen(p[0], p[1], width, height);
    if (!drawing) {
      ctx.moveTo(sx, sy);
      drawing = true;
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  ctx.stroke();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  if (r <= 0) return false;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= SAMPLE_POINTS; i++) {
    const t = (i / SAMPLE_POINTS) * Math.PI * 2;
    points.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  strokePoints(ctx, viewport, width, height, points);
  return true;
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= SAMPLE_POINTS; i++) {
    const t = (i / SAMPLE_POINTS) * Math.PI * 2;
    points.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  strokePoints(ctx, viewport, width, height, points);
  return true;
}

function drawParabola(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  conic: ConicInfo,
): boolean {
  const p = conic.a ?? 0;
  if (p === 0) return false;
  const cx = conic.center?.x ?? 0;
  const cy = conic.center?.y ?? 0;
  const points: Array<[number, number]> = [];

  if (conic.isVertical) {
    const { xMin, xMax } = viewport;
    for (let i = 0; i <= SAMPLE_POINTS; i++) {
      const x = xMin + (i / SAMPLE_POINTS) * (xMax - xMin);
      points.push([x, cy + ((x - cx) * (x - cx)) / (4 * p)]);
    }
  } else {
    const { yMin, yMax } = viewport;
    for (let i = 0; i <= SAMPLE_POINTS; i++) {
      const y = yMin + (i / SAMPLE_POINTS) * (yMax - yMin);
      points.push([cx + ((y - cy) * (y - cy)) / (4 * p), y]);
    }
  }
  strokePoints(ctx, viewport, width, height, points);
  return true;
}

/** Draws one hyperbola branch by sampling its free variable (x when the branch fn maps
 *  x -> y, or y when it maps y -> x) over the viewport, skipping points outside its domain. */
function drawHyperbolaBranch(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  fn: (t: number) => number | null,
  tMin: number,
  tMax: number,
  isVertical: boolean,
): void {
  const points: Array<[number, number] | null> = [];
  for (let i = 0; i <= SAMPLE_POINTS; i++) {
    const t = tMin + (i / SAMPLE_POINTS) * (tMax - tMin);
    const other = fn(t);
    if (other === null || !isFinite(other)) {
      points.push(null);
      continue;
    }
    points.push(isVertical ? [other, t] : [t, other]);
  }
  strokePoints(ctx, viewport, width, height, points);
}

function drawHyperbola(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  conic: ConicInfo,
): boolean {
  const { a, b } = conic;
  if (!a || !b || a <= 0 || b <= 0) return false;
  const cx = conic.center?.x ?? 0;
  const cy = conic.center?.y ?? 0;

  if (conic.isVertical) {
    // y = cy +/- a*sqrt(1 + (x-cx)^2/b^2) — both branches are defined for every x.
    const upper = (x: number) => cy + a * Math.sqrt(1 + ((x - cx) * (x - cx)) / (b * b));
    const lower = (x: number) => cy - a * Math.sqrt(1 + ((x - cx) * (x - cx)) / (b * b));
    drawHyperbolaBranch(ctx, viewport, width, height, upper, viewport.xMin, viewport.xMax, false);
    drawHyperbolaBranch(ctx, viewport, width, height, lower, viewport.xMin, viewport.xMax, false);
    return true;
  }

  // x^2/a^2 - y^2/b^2 = 1 — defined only for |x-cx| >= a, i.e. two disjoint branches
  // clipped to whichever side of the viewport they're actually visible on.
  const upper = (x: number) => {
    const d = ((x - cx) * (x - cx)) / (a * a) - 1;
    return d >= 0 ? cy + b * Math.sqrt(d) : null;
  };
  const lower = (x: number) => {
    const d = ((x - cx) * (x - cx)) / (a * a) - 1;
    return d >= 0 ? cy - b * Math.sqrt(d) : null;
  };

  const rightStart = Math.max(cx + a, viewport.xMin);
  const rightEnd = viewport.xMax;
  if (rightEnd > rightStart) {
    drawHyperbolaBranch(ctx, viewport, width, height, upper, rightStart, rightEnd, false);
    drawHyperbolaBranch(ctx, viewport, width, height, lower, rightStart, rightEnd, false);
  }

  const leftStart = viewport.xMin;
  const leftEnd = Math.min(cx - a, viewport.xMax);
  if (leftEnd > leftStart) {
    drawHyperbolaBranch(ctx, viewport, width, height, upper, leftStart, leftEnd, false);
    drawHyperbolaBranch(ctx, viewport, width, height, lower, leftStart, leftEnd, false);
  }

  return true;
}

/**
 * Draws a recognized conic (circle/ellipse/parabola/hyperbola) parametrically
 * — ~300 points total per branch — instead of the marching-squares grid used
 * for generic implicit curves. Returns false (drawing nothing) when the conic
 * is degenerate, so the caller can fall back to the generic renderer.
 */
export function drawConicCurve(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  conic: ConicInfo,
  color: string,
  width: number,
  height: number,
): boolean {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const cx = conic.center?.x ?? 0;
  const cy = conic.center?.y ?? 0;

  switch (conic.type) {
    case 'circle':
      return drawCircle(ctx, viewport, width, height, cx, cy, conic.radius ?? 0);
    case 'ellipse': {
      const { a, b, isVertical } = conic;
      if (!a || !b) return false;
      const rx = isVertical ? b : a;
      const ry = isVertical ? a : b;
      return drawEllipse(ctx, viewport, width, height, cx, cy, rx, ry);
    }
    case 'parabola':
      return drawParabola(ctx, viewport, width, height, conic);
    case 'hyperbola':
      return drawHyperbola(ctx, viewport, width, height, conic);
    default:
      return false;
  }
}
