import { Viewport } from './viewport';
import { tryEval, findAxisCrossings } from './utils';
import { drawLabelBlock } from './calculus-renderer';
import { detectAsymptotes } from '../engine/asymptote-detector';
import type { Asymptote } from '../engine/asymptote-detector';
import type { ExpressionNode } from '../engine/parser';

// Canvas 2D context does not support CSS variables; colors are hardcoded intentionally.

/** A sample interval is halved at most this many times while refining (~ the double mantissa). */
const MAX_REFINE_DEPTH = 64;
/** A parametric step whose midpoint is farther than this from the chord is refined, in px. */
const SMOOTH_TOLERANCE_PX = 1;
/** A short step moving more than this is probed for a jump, in px. */
const JUMP_PROBE_PX = 3;
/** Halvings a jump probe follows (~1/1000 px): a change still concentrated there is a jump. */
const JUMP_PROBE_DEPTH = 10;

type Pt = [number, number];

/**
 * Strokes t -> point(t) (screen px) for t in [t0, t1] from `samples` uniform steps.
 * - Points are clamped to one canvas size beyond each edge: path coordinates stay bounded at any
 *   zoom and an off-screen run stays off-screen.
 * - A step that moves more than half the canvas is bisected: a steep but continuous piece
 *   converges and is drawn, a pole or a jump never does and the path breaks there.
 * - A shorter step moving more than JUMP_PROBE_PX is probed: if its change stays concentrated in
 *   a vanishing interval it is a finite jump and the path breaks there too (y = f(x), x = g(y)).
 * - A step next to an undefined sample is extended to the edge of the domain (sqrt at 0, r = 1/θ).
 * - `smooth` also bisects steps whose midpoint is off the chord (parametric curves, few samples).
 * Refinement draws on a budget of extra evaluations (`samples`, 4x with `smooth`) to bound a frame.
 */
function traceCurve(
  ctx: CanvasRenderingContext2D,
  point: (t: number) => Pt,
  t0: number,
  t1: number,
  samples: number,
  width: number,
  height: number,
  smooth = false,
): void {
  let budget = smooth ? 4 * samples : samples;
  const at = (t: number): Pt | null => {
    const [x, y] = point(t);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [Math.min(2 * width, Math.max(-width, x)), Math.min(2 * height, Math.max(-height, y))];
  };
  const far = (a: Pt, b: Pt): boolean =>
    Math.abs(b[0] - a[0]) > width / 2 || Math.abs(b[1] - a[1]) > height / 2;
  const bent = (a: Pt, m: Pt, b: Pt): boolean =>
    Math.hypot(m[0] - (a[0] + b[0]) / 2, m[1] - (a[1] + b[1]) / 2) > SMOOTH_TOLERANCE_PX;

  const span = (a: Pt, b: Pt): number => Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  /** The two sides of a jump inside [ta, tb], or null if the step is continuous. */
  const jump = (ta: number, a: Pt, tb: number, b: Pt): [Pt, Pt] | null => {
    const d0 = span(a, b);
    for (let k = 0; k < JUMP_PROBE_DEPTH; k++) {
      const tm = (ta + tb) / 2;
      if (tm === ta || tm === tb) return null; // float-quantized t (far pans): keep the line
      const m = budget-- > 0 ? at(tm) : null;
      if (!m) return null;
      // Follow the half holding more of the change; a continuous piece halves it within a few levels.
      if (span(a, m) >= span(m, b)) [tb, b] = [tm, m];
      else [ta, a] = [tm, m];
      if (span(a, b) <= d0 / 2) return null;
    }
    return [a, b];
  };

  const join = (ta: number, a: Pt, tb: number, b: Pt, depth: number): void => {
    const isFar = far(a, b);
    if (!isFar && !smooth) {
      // shortcut: parametric/polar (smooth) steps are not probed, add it if piecewise ones need it.
      const j = span(a, b) > JUMP_PROBE_PX ? jump(ta, a, tb, b) : null;
      if (j) {
        ctx.lineTo(j[0][0], j[0][1]);
        ctx.moveTo(j[1][0], j[1][1]);
      }
      return void ctx.lineTo(b[0], b[1]);
    }
    const tm = (ta + tb) / 2;
    const m = depth > 0 && tm !== ta && tm !== tb && budget-- > 0 ? at(tm) : null;
    if (!m || (!isFar && !bent(a, m, b))) {
      if (isFar) ctx.moveTo(b[0], b[1]);
      else ctx.lineTo(b[0], b[1]);
      return;
    }
    join(ta, a, tm, m, depth - 1);
    join(tm, m, tb, b, depth - 1);
  };
  /** Last defined point between a defined `tIn` and an undefined `tOut`. */
  const edge = (tIn: number, pIn: Pt, tOut: number): [number, Pt] => {
    for (let d = 0; d < MAX_REFINE_DEPTH && budget-- > 0; d++) {
      const tm = (tIn + tOut) / 2;
      if (tm === tIn || tm === tOut) break;
      const m = at(tm);
      if (m) [tIn, pIn] = [tm, m];
      else tOut = tm;
    }
    return [tIn, pIn];
  };

  ctx.beginPath();
  let prevT = t0;
  let prev: Pt | null = null;
  for (let i = 0; i <= samples; i++) {
    const t = t0 + (i / samples) * (t1 - t0);
    const p = at(t);
    if (p && prev) join(prevT, prev, t, p, MAX_REFINE_DEPTH);
    else if (p && i > 0) {
      const [te, pe] = edge(t, p, prevT);
      ctx.moveTo(pe[0], pe[1]);
      join(te, pe, t, p, MAX_REFINE_DEPTH);
    } else if (p) ctx.moveTo(p[0], p[1]);
    else if (prev) {
      const [te, pe] = edge(prevT, prev, t);
      join(prevT, prev, te, pe, MAX_REFINE_DEPTH);
    }
    prevT = t;
    prev = p;
  }
  ctx.stroke();
}

function evalOrNaN(fn: (t: number) => number, t: number): number {
  try {
    return fn(t);
  } catch {
    return NaN;
  }
}

function setStroke(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function getVerticalAsymptotes(
  fn: (x: number) => number,
  viewport: Viewport,
  eps: number,
  ast?: ExpressionNode,
  variant?: string,
): number[] {
  const asymptotes = detectAsymptotes(fn, viewport.xMin, viewport.xMax, ast, variant);
  return asymptotes
    .filter((a) => a.type === 'vertical')
    .map((a) => a.value)
    .filter((v) => v > viewport.xMin + eps && v < viewport.xMax - eps)
    .sort((a, b) => a - b);
}

function drawFunctionSegment(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  xStart: number,
  xEnd: number,
  width: number,
  height: number,
): void {
  const [startPx] = viewport.worldToScreen(xStart, 0, width, height);
  const [endPx] = viewport.worldToScreen(xEnd, 0, width, height);
  const pixelWidth = Math.min(width, Math.ceil(endPx)) - Math.max(0, Math.floor(startPx));
  if (pixelWidth < 1) return;

  const samples = Math.max(200, pixelWidth * 4);
  const point = (x: number): Pt => viewport.worldToScreen(x, evalOrNaN(fn, x), width, height);
  traceCurve(ctx, point, xStart, xEnd, samples, width, height);
}

export function drawFunction(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  color: string,
  width: number,
  height: number,
  ast?: ExpressionNode,
  /** Cache key for what fn depends on besides ast (the angle unit), see detectAsymptotes. */
  variant?: string,
): void {
  // Gap left at each side of a vertical asymptote, relative to the view so it works at any zoom.
  const eps = (viewport.xMax - viewport.xMin) * 1e-9;
  setStroke(ctx, color);
  let start = viewport.xMin;
  for (const ax of getVerticalAsymptotes(fn, viewport, eps, ast, variant)) {
    if (ax > start + eps) drawFunctionSegment(ctx, viewport, fn, start, ax - eps, width, height);
    start = ax + eps;
  }
  if (start < viewport.xMax - eps) {
    drawFunctionSegment(ctx, viewport, fn, start, viewport.xMax, width, height);
  }
}

/** Draws x = g(y): samples y across the visible viewport range and plots (g(y), y). */
export function drawExplicitY(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (y: number) => number,
  color: string,
  width: number,
  height: number,
): void {
  setStroke(ctx, color);
  const point = (y: number): Pt => viewport.worldToScreen(evalOrNaN(fn, y), y, width, height);
  traceCurve(ctx, point, viewport.yMin, viewport.yMax, Math.max(200, height * 2), width, height);
}

/** Upper bound of samples when shading a region; keeps a frame bounded for any a/b. */
const MAX_FILL_STEPS = 4000;

/** Clamps integration limits to the viewport plus one viewport-width of margin on each side;
 *  only what is on screen is drawn, and absurd limits (1e308) cannot blow up the step count.
 *  Non-finite limits fall back to the viewport edges. */
function clampToViewportX(viewport: Viewport, a: number, b: number): [number, number] {
  const margin = viewport.xMax - viewport.xMin;
  const lo = viewport.xMin - margin;
  const hi = viewport.xMax + margin;
  const clamp = (v: number, fallback: number): number =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  return [clamp(a, lo), clamp(b, hi)];
}

export function drawIntegralArea(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  a: number,
  b: number,
  color: string,
  width: number,
  height: number,
): void {
  [a, b] = clampToViewportX(viewport, a, b);
  const [sa] = viewport.worldToScreen(a, 0, width, height);
  const [sb] = viewport.worldToScreen(b, 0, width, height);
  const [, oy] = viewport.worldToScreen(0, 0, width, height);

  const steps = Math.min(MAX_FILL_STEPS, Math.max(100, Math.ceil(Math.abs(sb - sa))));
  const h = (b - a) / steps;

  ctx.fillStyle = color + '30';
  // Non-finite stretches are skipped (never filled as 0): the polygon is closed at the last
  // valid sample so a diverging/undefined integrand does not look shaded as if valid.
  let drawing = false;
  let lastSx = 0;
  const closeShape = (): void => {
    ctx.lineTo(lastSx, oy);
    ctx.closePath();
    ctx.fill();
    drawing = false;
  };
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (!Number.isFinite(y)) {
      if (drawing) closeShape();
      continue;
    }
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    if (!drawing) {
      ctx.beginPath();
      ctx.moveTo(sx, oy);
      ctx.lineTo(sx, sy);
      drawing = true;
    } else {
      ctx.lineTo(sx, sy);
    }
    lastSx = sx;
  }
  if (drawing) closeShape();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sa, 0);
  ctx.lineTo(sa, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sb, 0);
  ctx.lineTo(sb, height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

export function drawAreaBetween(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fUpper: (x: number) => number,
  fLower: (x: number) => number,
  a: number,
  b: number,
  color: string,
  width: number,
  height: number,
): void {
  [a, b] = clampToViewportX(viewport, a, b);
  const steps = Math.min(MAX_FILL_STEPS, Math.max(200, Math.abs(b - a) * 20));
  const subIntervals: Array<{ start: number; end: number; topIsUpper: boolean }> = [];
  const crossPoints = findAxisCrossings(
    (x) => tryEval(fUpper, x) - tryEval(fLower, x),
    a,
    b,
    0,
    steps,
  );

  const boundaries = [a, ...crossPoints, b];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const ia = boundaries[i];
    const ib = boundaries[i + 1];
    const mid = (ia + ib) / 2;
    const yU = tryEval(fUpper, mid);
    const yL = tryEval(fLower, mid);
    if (isNaN(yU) || isNaN(yL)) continue;
    subIntervals.push({ start: ia, end: ib, topIsUpper: yU >= yL });
  }

  ctx.fillStyle = color + '25';

  for (const interval of subIntervals) {
    const { start, end, topIsUpper } = interval;
    const intervalSteps = Math.min(
      MAX_FILL_STEPS,
      Math.max(50, Math.ceil(Math.abs(end - start) * 20)),
    );
    const ih = (end - start) / intervalSteps;

    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= intervalSteps; i++) {
      const x = start + i * ih;
      const y = topIsUpper ? tryEval(fUpper, x) : tryEval(fLower, x);
      if (isNaN(y)) {
        if (drawing) {
          const prevX = start + (i - 1) * ih;
          const prevY = topIsUpper ? tryEval(fUpper, prevX) : tryEval(fLower, prevX);
          if (!isNaN(prevY)) {
            const [sx, sy] = viewport.worldToScreen(prevX, prevY, width, height);
            ctx.lineTo(sx, sy);
          }
          drawing = false;
        }
        continue;
      }
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!drawing) {
        ctx.moveTo(sx, sy);
        drawing = true;
      } else ctx.lineTo(sx, sy);
    }
    for (let i = intervalSteps; i >= 0; i--) {
      const x = start + i * ih;
      const y = topIsUpper ? tryEval(fLower, x) : tryEval(fUpper, x);
      if (isNaN(y)) continue;
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!drawing) {
        ctx.moveTo(sx, sy);
        drawing = true;
      } else ctx.lineTo(sx, sy);
    }
    if (drawing) {
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const [sax] = viewport.worldToScreen(a, 0, width, height);
  const [sbx] = viewport.worldToScreen(b, 0, width, height);
  ctx.beginPath();
  ctx.moveTo(sax, 0);
  ctx.lineTo(sax, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sbx, 0);
  ctx.lineTo(sbx, height);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const cp of crossPoints) {
    const [cpx] = viewport.worldToScreen(cp, 0, width, height);
    ctx.strokeStyle = color + '40';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cpx, 0);
    ctx.lineTo(cpx, height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.beginPath();
    const [, cpy] = viewport.worldToScreen(cp, tryEval(fUpper, cp), width, height);
    ctx.arc(cpx, cpy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  mouseX: number,
  mouseY: number,
  fn: ((x: number) => number) | null,
  color: string,
  width: number,
  height: number,
): void {
  const [wx, wy] = viewport.screenToWorld(mouseX, mouseY, width, height);

  ctx.strokeStyle = color + '40';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(mouseX, 0);
  ctx.lineTo(mouseX, height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, mouseY);
  ctx.lineTo(width, mouseY);
  ctx.stroke();
  ctx.setLineDash([]);

  let label = `(${wx.toFixed(2)}, ${wy.toFixed(2)})`;
  if (fn) {
    try {
      const fy = fn(wx);
      if (isFinite(fy)) {
        const [, sy] = viewport.worldToScreen(wx, fy, width, height);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mouseX, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        label = `(${wx.toFixed(2)}, ${fy.toFixed(2)})`;
      }
    } catch {
      /* ignore */
    }
  }

  drawLabelBlock(ctx, mouseX, mouseY, [label], color, width, height);
}

export function drawParametric(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fnX: (t: number) => number,
  fnY: (t: number) => number,
  tMin: number,
  tMax: number,
  color: string,
  width: number,
  height: number,
): void {
  setStroke(ctx, color);
  const steps = Math.min(10000, Math.max(500, Math.abs(tMax - tMin) * 50));
  const point = (t: number): Pt =>
    viewport.worldToScreen(evalOrNaN(fnX, t), evalOrNaN(fnY, t), width, height);
  traceCurve(ctx, point, tMin, tMax, steps, width, height, true);
}

export function drawPolar(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (theta: number) => number,
  thetaMin: number,
  thetaMax: number,
  color: string,
  width: number,
  height: number,
): void {
  setStroke(ctx, color);
  const steps = Math.min(10000, Math.max(500, Math.abs(thetaMax - thetaMin) * 50));
  const point = (theta: number): Pt => {
    const r = evalOrNaN(fn, theta);
    return viewport.worldToScreen(r * Math.cos(theta), r * Math.sin(theta), width, height);
  };
  traceCurve(ctx, point, thetaMin, thetaMax, steps, width, height, true);
}

export function drawInequality(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  comparison: '>' | '<' | '>=' | '<=',
  color: string,
  width: number,
  height: number,
  ast?: ExpressionNode,
  variant?: string,
): void {
  drawFunction(ctx, viewport, fn, color, width, height, ast, variant);

  const maxY = viewport.yMax + (viewport.yMax - viewport.yMin) * 0.1;
  const minY = viewport.yMin - (viewport.yMax - viewport.yMin) * 0.1;

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = color;

  // y > f(x) is the world region above the curve: screen rows from the top down to the curve.
  const above = comparison === '>' || comparison === '>=';

  for (let px = 0; px <= width; px += 2) {
    const [wx] = viewport.screenToWorld(px, 0, width, height);
    const wyFn = tryEval(fn, wx);
    if (isNaN(wyFn) || !isFinite(wyFn)) continue;

    const [, syFn] = viewport.worldToScreen(wx, wyFn, width, height);
    const [, syTop] = viewport.worldToScreen(wx, maxY, width, height);
    const [, syBot] = viewport.worldToScreen(wx, minY, width, height);

    const top = Math.max(syTop, 0);
    const bot = Math.min(syBot, height);

    if (above) {
      ctx.fillRect(px, top, 2, Math.max(0, Math.min(syFn, bot) - top));
    } else {
      const from = Math.max(syFn, top);
      ctx.fillRect(px, from, 2, Math.max(0, bot - from));
    }
  }

  ctx.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function inequalityCheck(comparison: '>' | '<' | '>=' | '<=') {
  switch (comparison) {
    case '>':
      return (val: number) => val > 0;
    case '<':
      return (val: number) => val < 0;
    case '>=':
      return (val: number) => val >= 0;
    case '<=':
      return (val: number) => val <= 0;
  }
}

const INEQUALITY_CELL_PX = 3;
const INEQUALITY_CELL_PX_COARSE = 6;

interface InequalityCacheEntry {
  key: string;
  canvas: HTMLCanvasElement;
}

// Keyed on the eval fn's identity: a shaded region is filled once into a small
// offscreen canvas (one fillRect-equivalent per coarse cell, via ImageData) and
// then just blitted with drawImage on every subsequent frame with the same
// viewport/size — instead of re-evaluating fn(x, y) at every 2px screen cell
// (width*height/4 evaluations) every single frame.
const inequalityCache = new WeakMap<object, InequalityCacheEntry>();

export function drawImplicitInequality(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number, y: number) => number,
  comparison: '>' | '<' | '>=' | '<=',
  color: string,
  width: number,
  height: number,
  coarse = false,
): void {
  if (width <= 0 || height <= 0) return;
  const cellPx = coarse ? INEQUALITY_CELL_PX_COARSE : INEQUALITY_CELL_PX;
  const cols = Math.max(1, Math.round(width / cellPx));
  const rows = Math.max(1, Math.round(height / cellPx));
  // Exact bounds: a rounded key would reuse a stale fill after a sub-rounding pan at deep zoom.
  const key = `${viewport.xMin}:${viewport.xMax}:${viewport.yMin}:${viewport.yMax}:${cols}:${rows}:${comparison}:${color}`;

  let entry = inequalityCache.get(fn);
  if (!entry || entry.key !== key) {
    const small = document.createElement('canvas');
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext('2d');
    if (!sctx) return;

    const img = sctx.createImageData(cols, rows);
    const [r, g, b] = hexToRgb(color);
    const alpha = Math.round(0.15 * 255);
    const check = inequalityCheck(comparison);

    for (let row = 0; row < rows; row++) {
      const py = ((row + 0.5) / rows) * height;
      const base = row * cols;
      for (let col = 0; col < cols; col++) {
        const px = ((col + 0.5) / cols) * width;
        const [wx, wy] = viewport.screenToWorld(px, py, width, height);
        let val: number;
        try {
          val = fn(wx, wy);
        } catch {
          continue;
        }
        if (!check(val)) continue;
        const idx = (base + col) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = alpha;
      }
    }

    sctx.putImageData(img, 0, 0);
    entry = { key, canvas: small };
    inequalityCache.set(fn, entry);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.canvas, 0, 0, width, height);
  ctx.restore();
}

export function drawAsymptote(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  asymptote: Asymptote,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = '#666680';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  if (asymptote.type === 'vertical') {
    const [sx] = viewport.worldToScreen(asymptote.value, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    ctx.fillStyle = '#666680';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(asymptote.equation, sx + 4, 14);
  } else if (asymptote.type === 'horizontal') {
    const [, sy] = viewport.worldToScreen(0, asymptote.value, width, height);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    ctx.fillStyle = '#666680';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(asymptote.equation, 4, sy - 4);
  } else if (asymptote.type === 'oblique') {
    const y1 = asymptote.value * viewport.xMin + (asymptote.intercept ?? 0);
    const y2 = asymptote.value * viewport.xMax + (asymptote.intercept ?? 0);
    const [sx1, sy1] = viewport.worldToScreen(viewport.xMin, y1, width, height);
    const [sx2, sy2] = viewport.worldToScreen(viewport.xMax, y2, width, height);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }

  ctx.restore();
}
