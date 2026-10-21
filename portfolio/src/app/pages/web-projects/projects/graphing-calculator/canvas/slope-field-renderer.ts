import { solveIvp } from '../engine/ode';
import type { OdeView } from '../state/calculus-f8-view';
import { Viewport } from './viewport';

// Canvas 2D cannot read CSS variables. The solution is ink (--color-text), not a palette colour,
// so it never reads as a y = f(x) row (f1 defaults to #00ff88); the target is a ring on the canvas
// background (--color-canvas-bg), the start a filled dot.
export const COLOR_SLOPE_FIELD = '#5a5a78';
export const COLOR_ODE_SOLUTION = '#e0e0e0';
const COLOR_ODE_MARKER = '#0d0d15';
/** Screen px between slope-field nodes, and the half length of each segment. */
const GRID_PX = 24;
const SEG_HALF_PX = 8;
/** Screen px between targets handed to the adaptive solver. */
const TARGET_STEP_PX = 2;
/** Fixed-step polylines stop after this many steps per side. */
const MAX_POLYLINE_STEPS = 2000;

type Pt = [number, number];

/** Solution polyline (world points) on one side of x0, stopping at the first failed point. */
function rk45Side(view: OdeView, xs: number[]): Pt[] {
  const results = solveIvp(view.slope, view.x0, view.y0, xs);
  const pts: Pt[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (results[i].status !== 'ok') break;
    pts.push([xs[i], results[i].value]);
  }
  return pts;
}

/** Euler / RK4 vertices x0 + k·dir·h, the same recurrences as stepIvp, until past `limit`. */
function fixedSide(view: OdeView, dir: 1 | -1, limit: number): Pt[] {
  const h = Math.abs(view.h ?? 0) * dir;
  const f = view.slope;
  const pts: Pt[] = [];
  if (!h) return pts;
  let x = view.x0;
  let y = view.y0;
  for (let k = 1; k <= MAX_POLYLINE_STEPS; k++) {
    const k1 = f(x, y);
    if (view.method === 'euler') y += h * k1;
    else {
      const k2 = f(x + h / 2, y + (h / 2) * k1);
      const k3 = f(x + h / 2, y + (h / 2) * k2);
      const k4 = f(x + h, y + h * k3);
      y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    x = view.x0 + k * h;
    if (!Number.isFinite(y)) break;
    pts.push([x, y]);
    if (dir * (x - limit) > 0) break;
  }
  return pts;
}

function stroke(ctx: CanvasRenderingContext2D, vp: Viewport, pts: Pt[], w: number, h: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const [sx, sy] = vp.worldToScreen(x, y, w, h);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.stroke();
}

function marker(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const [sx, sy] = vp.worldToScreen(x, y, w, h);
  ctx.beginPath();
  ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Direction field (normalized segments on a screen grid), the solution through (x₀, y₀) and markers. */
export function drawSlopeField(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  view: OdeView,
  width: number,
  height: number,
): void {
  drawField(ctx, viewport, view, width, height);
  if (view.error || !Number.isFinite(view.x0) || !Number.isFinite(view.y0)) return;
  ctx.save();
  ctx.strokeStyle = COLOR_ODE_SOLUTION;
  ctx.fillStyle = COLOR_ODE_SOLUTION;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  const { xMin, xMax } = viewport;
  let right: Pt[];
  let left: Pt[];
  if (view.method === 'rk45') {
    const n = Math.ceil(width / TARGET_STEP_PX);
    const grid = Array.from({ length: n + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / n);
    right = rk45Side(
      view,
      grid.filter((x) => x > view.x0),
    );
    left = rk45Side(view, grid.filter((x) => x < view.x0).reverse());
  } else {
    right = fixedSide(view, 1, xMax);
    left = fixedSide(view, -1, xMin);
  }
  const start: Pt = [view.x0, view.y0];
  stroke(ctx, viewport, [...left.reverse(), start, ...right], width, height);
  marker(ctx, viewport, view.x0, view.y0, width, height);
  ctx.fillStyle = COLOR_ODE_MARKER;
  ctx.strokeStyle = COLOR_ODE_SOLUTION;
  if (view.end?.status === 'ok' && view.xEnd !== null) {
    marker(ctx, viewport, view.xEnd, view.end.value, width, height);
  }
  ctx.restore();
}

function drawField(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  view: OdeView,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLOR_SLOPE_FIELD;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let sx = GRID_PX / 2; sx < width; sx += GRID_PX) {
    for (let sy = GRID_PX / 2; sy < height; sy += GRID_PX) {
      const [wx, wy] = viewport.screenToWorld(sx, sy, width, height);
      const m = view.slope(wx, wy);
      if (Number.isNaN(m)) continue;
      // Direction in screen space (y is flipped and the axes may have different scales).
      let dx: number;
      let dy: number;
      if (Number.isFinite(m)) {
        const [ax, ay] = viewport.worldToScreen(wx + 1, wy + m, width, height);
        dx = ax - sx;
        dy = ay - sy;
      } else {
        dx = 0;
        dy = m > 0 ? -1 : 1;
      }
      const len = Math.hypot(dx, dy) || 1;
      const ux = (dx / len) * SEG_HALF_PX;
      const uy = (dy / len) * SEG_HALF_PX;
      ctx.moveTo(sx - ux, sy - uy);
      ctx.lineTo(sx + ux, sy + uy);
    }
  }
  ctx.stroke();
  ctx.restore();
}
