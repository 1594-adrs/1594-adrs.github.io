import type { SeriesView, TaylorView } from '../state/calculus-f8-view';
import { tryEval } from './utils';
import { Viewport } from './viewport';

// Canvas 2D context does not support CSS variables; colors mirror the design tokens
// (--color-bg-dark, --color-text, --color-text-muted) and the trace label border.
const COLOR_LABEL_BG = '#0a0a0f';
const COLOR_LABEL_BORDER = '#333355';
const COLOR_INK = '#e0e0e0';
const COLOR_GUIDE = '#80809a';
/** Sequence terms aₙ (filled), partial sums Sₙ (rings) and the series sum line. */
export const COLOR_SEQ_TERM = '#00e5ff';
export const COLOR_SEQ_PARTIAL = '#ffb300';
export const COLOR_SEQ_SUM = '#ff6bd6';
/** Most sequence points drawn per series. */
export const SEQ_MAX_POINTS = 500;
/** Screen px between samples of the Taylor polynomial. */
const TAYLOR_STEP_PX = 2;
const FONT = '11px "JetBrains Mono", monospace';
const LINE_H = 15;
const PAD = 4;
const OFFSET = 12;
/** Newton labels closer than this (screen px) to the previous one are skipped. */
const NEWTON_LABEL_GAP_PX = 18;
/** Newton steps drawn on the canvas (the table lists them all). */
/** Keeps right-edge labels clear of the zoom/tool button column overlaid on the canvas. */
const CONTROLS_CLEARANCE = 60;

export const NEWTON_MAX_DRAWN = 20;

/** "x₀", "x₁₂". */
export function subscriptX(n: number): string {
  return 'x' + String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
}

/** Endpoints (screen px) of the line through (x0, y0) with `slope` across the viewport;
 *  vertical when the slope is ±Infinity, null when it is NaN. */
export function lineScreenSegment(
  viewport: Viewport,
  x0: number,
  y0: number,
  slope: number,
  width: number,
  height: number,
): [number, number, number, number] | null {
  if (Number.isNaN(slope) || !Number.isFinite(x0) || !Number.isFinite(y0)) return null;
  if (!Number.isFinite(slope)) {
    const [sx] = viewport.worldToScreen(x0, 0, width, height);
    return [sx, 0, sx, height];
  }
  const { xMin, xMax } = viewport;
  const [ax, ay] = viewport.worldToScreen(xMin, y0 + slope * (xMin - x0), width, height);
  const [bx, by] = viewport.worldToScreen(xMax, y0 + slope * (xMax - x0), width, height);
  return [ax, ay, bx, by];
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  seg: [number, number, number, number],
  color: string,
  lineWidth: number,
  dash: number[],
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(seg[0], seg[1]);
  ctx.lineTo(seg[2], seg[3]);
  ctx.stroke();
}

/** A boxed multi-line label near (sx, sy), flipped to stay inside the canvas. The first line
 *  takes `color`; the rest are plain ink. */
export function drawLabelBlock(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  lines: string[],
  color: string,
  width: number,
  height: number,
  maxRight = width,
): void {
  if (lines.length === 0) return;
  ctx.save();
  ctx.font = FONT;
  ctx.setLineDash([]);
  const labelW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + PAD * 2;
  const labelH = lines.length * LINE_H + PAD;
  const lx = Math.min(
    sx + OFFSET + labelW > maxRight ? Math.max(0, sx - OFFSET - labelW) : sx + OFFSET,
    Math.max(0, maxRight - labelW),
  );
  const above = sy - OFFSET - labelH;
  const ty = above < 0 ? Math.min(sy + OFFSET, Math.max(0, height - labelH)) : above;
  ctx.fillStyle = COLOR_LABEL_BG;
  ctx.strokeStyle = COLOR_LABEL_BORDER;
  ctx.lineWidth = 1;
  ctx.fillRect(lx, ty, labelW, labelH);
  ctx.strokeRect(lx, ty, labelW, labelH);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? color : COLOR_INK;
    ctx.fillText(line, lx + PAD, ty + PAD / 2 + LINE_H * (i + 0.5));
  });
  ctx.restore();
}

export interface TangentOverlay {
  kind: 'finite' | 'vertical' | 'dne' | 'unavailable';
  x: number;
  y: number;
  slope: number;
  lines: string[];
}

/** Tangent (curve color) and optional normal (muted, dotted) at a traced point, the point
 *  and its readout. 'dne' / 'unavailable' draw only the readout: no broken line. */
export function drawTangentOverlay(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  overlay: TangentOverlay,
  traceScreen: [number, number],
  color: string,
  showNormal: boolean,
  width: number,
  height: number,
): void {
  ctx.save();
  const drawable = overlay.kind === 'finite' || overlay.kind === 'vertical';
  if (drawable) {
    const tangent = lineScreenSegment(viewport, overlay.x, overlay.y, overlay.slope, width, height);
    if (tangent) strokeSegment(ctx, tangent, color, 1.5, []);
    if (showNormal) {
      const ns =
        overlay.slope === 0 ? Infinity : Number.isFinite(overlay.slope) ? -1 / overlay.slope : 0;
      const normal = lineScreenSegment(viewport, overlay.x, overlay.y, ns, width, height);
      if (normal) strokeSegment(ctx, normal, COLOR_GUIDE, 1.25, [2, 4]);
    }
  }
  const [sx, sy] = drawable
    ? viewport.worldToScreen(overlay.x, overlay.y, width, height)
    : traceScreen;
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawLabelBlock(ctx, sx, sy, overlay.lines, color, width, height);
}

export interface LimitMarker {
  x0: number;
  /** Limit value (±Infinity when infinite), NaN when it does not exist / is unknown. */
  value: number;
  text: string;
  color: string;
}

/**
 * Limit overlay. Finite x0: a dashed guide at x = x0 and a hollow ring at (x0, L) — or an
 * arrow label at the top/bottom edge when L = ±∞, a plain label when it does not exist.
 * x0 = ±∞: the horizontal asymptote y = L, labelled at the edge x tends to.
 */
export function drawLimitMarker(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  m: LimitMarker,
  width: number,
  height: number,
): void {
  ctx.save();
  const label = Number.isNaN(m.value) ? `limit ${m.text}` : `L = ${m.text}`;
  if (!Number.isFinite(m.x0)) {
    const edgeX = m.x0 > 0 ? width - CONTROLS_CLEARANCE : 4;
    if (Number.isFinite(m.value)) {
      const [, sy] = viewport.worldToScreen(0, m.value, width, height);
      strokeSegment(ctx, [0, sy, width, sy], COLOR_GUIDE, 1, [6, 4]);
      ctx.restore();
      drawLabelBlock(
        ctx,
        edgeX,
        sy,
        [label, `as x → ${m.x0 > 0 ? '∞' : '-∞'}`],
        m.color,
        width,
        height,
      );
      return;
    }
    ctx.restore();
    drawLabelBlock(
      ctx,
      edgeX,
      height / 2,
      [label, `as x → ${m.x0 > 0 ? '∞' : '-∞'}`],
      m.color,
      width,
      height,
    );
    return;
  }
  const [sx] = viewport.worldToScreen(m.x0, 0, width, height);
  strokeSegment(ctx, [sx, 0, sx, height], COLOR_GUIDE, 1, [6, 4]);
  if (Number.isFinite(m.value)) {
    const [, sy] = viewport.worldToScreen(m.x0, m.value, width, height);
    ctx.setLineDash([]);
    ctx.fillStyle = COLOR_LABEL_BG;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    drawLabelBlock(ctx, sx, sy, [label], m.color, width, height, width - CONTROLS_CLEARANCE);
    return;
  }
  ctx.restore();
  const edgeY = m.value === -Infinity ? height - 4 : m.value === Infinity ? 28 : height / 2;
  const arrow = m.value === Infinity ? '↑ ' : m.value === -Infinity ? '↓ ' : '';
  drawLabelBlock(
    ctx,
    sx,
    edgeY,
    [arrow + label],
    m.color,
    width,
    height,
    width - CONTROLS_CLEARANCE,
  );
}

/**
 * Newton's method: from each (xₙ, f(xₙ)) the tangent down to (xₙ₊₁, 0), then a dotted
 * vertical back up to the curve; x₀, x₁, … labelled on the axis (crowded labels skipped).
 */
export function drawNewtonSteps(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  rows: { n: number; x: number; fx: number }[],
  color: string,
  width: number,
  height: number,
): void {
  const shown = rows.slice(0, NEWTON_MAX_DRAWN + 1);
  ctx.save();
  for (let i = 0; i + 1 < shown.length; i++) {
    const a = shown[i];
    const b = shown[i + 1];
    if (![a.x, a.fx, b.x].every(Number.isFinite)) break;
    const [ax, ay] = viewport.worldToScreen(a.x, a.fx, width, height);
    const [bx, by] = viewport.worldToScreen(b.x, 0, width, height);
    strokeSegment(ctx, [ax, ay, bx, by], COLOR_INK, 1.25, []);
    if (Number.isFinite(b.fx)) {
      const [, cy] = viewport.worldToScreen(b.x, b.fx, width, height);
      strokeSegment(ctx, [bx, by, bx, cy], COLOR_GUIDE, 1, [2, 3]);
    }
  }
  if (shown.length > 0 && Number.isFinite(shown[0].x) && Number.isFinite(shown[0].fx)) {
    const [x0s, y0s] = viewport.worldToScreen(shown[0].x, 0, width, height);
    const [, f0s] = viewport.worldToScreen(shown[0].x, shown[0].fx, width, height);
    strokeSegment(ctx, [x0s, y0s, x0s, f0s], COLOR_GUIDE, 1, [2, 3]);
  }
  ctx.setLineDash([]);
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let lastLabelX = -Infinity;
  for (const r of shown) {
    if (!Number.isFinite(r.x)) break;
    const [sx, sy] = viewport.worldToScreen(r.x, 0, width, height);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    if (Math.abs(sx - lastLabelX) >= NEWTON_LABEL_GAP_PX) {
      const ly = Math.min(Math.max(sy + 6, 2), height - LINE_H);
      ctx.fillStyle = COLOR_INK;
      ctx.fillText(subscriptX(r.n), sx, ly);
      lastLabelX = sx;
    }
  }
  ctx.restore();
}

/** Dashed P_n(x) in the function colour, with a ring at (a, f(a)). */
export function drawTaylorPolynomial(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  view: TaylorView,
  width: number,
  height: number,
): void {
  if (view.coefficients.length === 0 || !view.coefficients.every(Number.isFinite)) return;
  ctx.save();
  ctx.strokeStyle = view.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  let pen = false;
  for (let sx = 0; sx <= width; sx += TAYLOR_STEP_PX) {
    const [wx] = viewport.screenToWorld(sx, 0, width, height);
    const wy = tryEval(view.evaluate, wx);
    if (Number.isNaN(wy)) {
      pen = false;
      continue;
    }
    const [, sy] = viewport.worldToScreen(wx, wy, width, height);
    if (pen) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
    pen = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const [px, py] = viewport.worldToScreen(view.center, view.coefficients[0], width, height);
  ctx.fillStyle = COLOR_LABEL_BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Dots (n, aₙ) and rings (n, Sₙ) for the visible integers n, and a dashed line at the sum. */
export function drawSequence(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  view: SeriesView,
  width: number,
  height: number,
): void {
  if (view.error) return;
  ctx.save();
  if (view.sum.status === 'finite') {
    const [, sy] = viewport.worldToScreen(0, view.sum.value, width, height);
    strokeSegment(ctx, [0, sy, width, sy], COLOR_SEQ_SUM, 1.5, [6, 4]);
  }
  ctx.setLineDash([]);
  const lo = Math.max(view.n0, Math.ceil(viewport.xMin));
  const hi = Math.min(Math.floor(viewport.xMax), lo + SEQ_MAX_POINTS - 1);
  // shortcut: Sₙ dots are skipped when the window starts over 1e5 terms past n₀ (the prefix sum
  // would stall a redraw); accumulate incrementally or use a closed form if that matters.
  let s = 0;
  let showSums = lo - view.n0 <= 1e5;
  for (let n = view.n0; showSums && n < lo; n++) s += view.term(n);
  for (let n = lo; n <= hi; n++) {
    const a = tryEval(view.term, n);
    const raw = view.term(n);
    s += raw;
    if (!Number.isFinite(s)) showSums = false;
    if (!Number.isNaN(a)) {
      const [sx, sy] = viewport.worldToScreen(n, a, width, height);
      ctx.fillStyle = COLOR_SEQ_TERM;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (showSums) {
      const [sx, sy] = viewport.worldToScreen(n, s, width, height);
      ctx.strokeStyle = COLOR_SEQ_PARTIAL;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
