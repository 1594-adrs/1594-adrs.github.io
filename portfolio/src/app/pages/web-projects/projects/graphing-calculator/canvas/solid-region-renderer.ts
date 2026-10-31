import { Viewport } from './viewport';
import { tryEval } from './utils';
import { canvasPalette } from './palette';
import type { AxisLine, SolidPiece, SolidSpec } from '../engine/solids/solid.types';

const RADIUS_FONT = 'italic 600 15px "Times New Roman", "KaTeX_Main", serif';
const RADIUS_GAP_PX = 7;
const RADIUS_TICK_PX = 4;
const RADIUS_TEXT_PX = 9;
const MIN_RADIUS_PX = 8;

function baselineFor(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

function boundaryValue(spec: SolidSpec, index: number | null, t: number, baseline: number): number {
  if (index === null) return baseline;
  return tryEval(spec.curves[index].fn, t);
}

function boundaryColor(spec: SolidSpec, piece: SolidPiece): string {
  const idx = piece.upperIndex ?? piece.lowerIndex;
  return idx === null ? '#00ff88' : spec.curves[idx].color;
}

/** Maps a (variable-value, boundary-value) pair to screen coords for the current variable. */
function toScreen(
  viewport: Viewport,
  variable: SolidSpec['variable'],
  t: number,
  v: number,
  width: number,
  height: number,
): [number, number] {
  return variable === 'x'
    ? viewport.worldToScreen(t, v, width, height)
    : viewport.worldToScreen(v, t, width, height);
}

type Mirror = (t: number, v: number) => [number, number];

/** Reflection across the axis of revolution: the solid's outline in the plane of the region. */
function mirrorFor(spec: SolidSpec): Mirror | null {
  const axis = spec.axis;
  if (!axis || spec.method === 'cross-section') return null;
  const k = axis.value;
  return spec.method === 'disk-washer' ? (t, v) => [t, 2 * k - v] : (t, v) => [2 * k - t, v];
}

/** Builds the closed outline of a piece (optionally mirrored); false when nothing is finite. */
function tracePiece(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  piece: SolidPiece,
  baseline: number,
  width: number,
  height: number,
  mirror: Mirror = (t, v) => [t, v],
): boolean {
  const n = Math.max(20, Math.min(400, Math.round(Math.abs(piece.b - piece.a) * 40)));
  const h = (piece.b - piece.a) / n;

  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= n; i++) {
    const t = piece.a + i * h;
    const u = boundaryValue(spec, piece.upperIndex, t, baseline);
    if (!Number.isFinite(u)) continue;
    const [sx, sy] = toScreen(viewport, spec.variable, ...mirror(t, u), width, height);
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  for (let i = n; i >= 0; i--) {
    const t = piece.a + i * h;
    const l = boundaryValue(spec, piece.lowerIndex, t, baseline);
    if (!Number.isFinite(l)) continue;
    const [sx, sy] = toScreen(viewport, spec.variable, ...mirror(t, l), width, height);
    ctx.lineTo(sx, sy);
  }
  if (!started) return false;
  ctx.closePath();
  return true;
}

function drawPieceFill(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  piece: SolidPiece,
  baseline: number,
  width: number,
  height: number,
): void {
  if (!tracePiece(ctx, viewport, spec, piece, baseline, width, height)) return;
  ctx.fillStyle = boundaryColor(spec, piece) + '30';
  ctx.fill();
}

function drawPieceMirror(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  piece: SolidPiece,
  baseline: number,
  mirror: Mirror,
  width: number,
  height: number,
): void {
  if (!tracePiece(ctx, viewport, spec, piece, baseline, width, height, mirror)) return;
  ctx.save();
  ctx.strokeStyle = boundaryColor(spec, piece) + 'aa';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
}

function drawAxisLine(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  axis: AxisLine,
  width: number,
  height: number,
): void {
  const palette = canvasPalette();
  ctx.save();
  ctx.strokeStyle = palette.revolutionAxisLine;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  if (axis.orientation === 'horizontal') {
    const [, sy] = viewport.worldToScreen(0, axis.value, width, height);
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (sy >= 10 && sy <= height - 10) {
      ctx.fillStyle = palette.revolutionAxisLabel;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`y = ${axis.value}`, 6, sy - 4);
    }
  } else {
    const [sx] = viewport.worldToScreen(axis.value, 0, width, height);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    ctx.setLineDash([]);
    if (sx >= 10 && sx <= width - 10) {
      ctx.fillStyle = palette.revolutionAxisLabel;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`x = ${axis.value}`, sx + 4, 14);
    }
  }
  ctx.restore();
}

export interface WasherRadii {
  axis: number;
  outer: number;
  inner: number | null;
}

export function washerRadii(spec: SolidSpec, piece: SolidPiece, t: number): WasherRadii | null {
  if (spec.method !== 'disk-washer' || !spec.axis) return null;
  const k = spec.axis.value;
  const u = boundaryValue(spec, piece.upperIndex, t, k);
  const l = boundaryValue(spec, piece.lowerIndex, t, k);
  if (!Number.isFinite(u) || !Number.isFinite(l)) return null;
  const upperIsOuter = Math.abs(u - k) >= Math.abs(l - k);
  const axisOutside = k < Math.min(u, l) || k > Math.max(u, l);
  return {
    axis: k,
    outer: upperIsOuter ? u : l,
    inner: axisOutside ? (upperIsOuter ? l : u) : null,
  };
}

export interface RadiusSegment {
  label: 'R' | 'r';
  from: [number, number];
  to: [number, number];
  anchor: [number, number];
  along: [number, number];
}

export function washerRadiusLayout(
  viewport: Viewport,
  spec: SolidSpec,
  piece: SolidPiece,
  t: number,
  halfWidth: number,
  width: number,
  height: number,
): RadiusSegment[] | null {
  const radii = washerRadii(spec, piece, t);
  if (!radii) return null;
  const at = (tt: number, v: number) => toScreen(viewport, spec.variable, tt, v, width, height);
  const [ax, ay] = at(t, radii.axis);
  const [px, py] = at(t + halfWidth, radii.axis);
  const side: [number, number] = spec.variable === 'x' ? [1, 0] : [0, -1];
  const off = Math.hypot(px - ax, py - ay) + RADIUS_GAP_PX;

  const segment = (label: 'R' | 'r', value: number, sign: 1 | -1): RadiusSegment | null => {
    const [bx, by] = at(t, value);
    const len = Math.hypot(bx - ax, by - ay);
    if (!(len >= MIN_RADIUS_PX)) return null;
    const dx = side[0] * off * sign;
    const dy = side[1] * off * sign;
    const tx = side[0] * RADIUS_TEXT_PX * sign;
    const ty = side[1] * RADIUS_TEXT_PX * sign;
    return {
      label,
      from: [ax + dx, ay + dy],
      to: [bx + dx, by + dy],
      anchor: [(ax + bx) / 2 + dx + tx, (ay + by) / 2 + dy + ty],
      along: [(bx - ax) / len, (by - ay) / len],
    };
  };

  const out: RadiusSegment[] = [];
  const outer = segment('R', radii.outer, 1);
  if (outer) out.push(outer);
  const inner = radii.inner === null ? null : segment('r', radii.inner, -1);
  if (inner) out.push(inner);
  return out;
}

function drawRadiusLabels(ctx: CanvasRenderingContext2D, segments: RadiusSegment[]): void {
  if (segments.length === 0) return;
  const palette = canvasPalette();
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  for (const [color, lineWidth] of [
    [palette.halo, 4],
    [palette.ink, 1.5],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const s of segments) {
      const nx = -s.along[1] * RADIUS_TICK_PX;
      const ny = s.along[0] * RADIUS_TICK_PX;
      ctx.moveTo(s.from[0], s.from[1]);
      ctx.lineTo(s.to[0], s.to[1]);
      for (const [ex, ey] of [s.from, s.to]) {
        ctx.moveTo(ex - nx, ey - ny);
        ctx.lineTo(ex + nx, ey + ny);
      }
    }
    ctx.stroke();
  }
  ctx.font = RADIUS_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = palette.halo;
  ctx.fillStyle = palette.ink;
  for (const s of segments) {
    ctx.strokeText(s.label, s.anchor[0], s.anchor[1]);
    ctx.fillText(s.label, s.anchor[0], s.anchor[1]);
  }
  ctx.restore();
}

function findPiece(pieces: SolidPiece[], t: number): SolidPiece | null {
  for (const p of pieces) {
    if (t >= p.a - 1e-9 && t <= p.b + 1e-9) return p;
  }
  return pieces.length > 0 ? pieces[pieces.length - 1] : null;
}

function drawStripAt(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  piece: SolidPiece,
  t: number,
  halfWidth: number,
  baseline: number,
  color: string,
  width: number,
  height: number,
  mirror: Mirror = (t, v) => [t, v],
): void {
  const t0 = Math.max(piece.a, t - halfWidth);
  const t1 = Math.min(piece.b, t + halfWidth);
  const u0 = boundaryValue(spec, piece.upperIndex, t0, baseline);
  const l0 = boundaryValue(spec, piece.lowerIndex, t0, baseline);
  const u1 = boundaryValue(spec, piece.upperIndex, t1, baseline);
  const l1 = boundaryValue(spec, piece.lowerIndex, t1, baseline);
  if (![u0, l0, u1, l1].every(Number.isFinite)) return;

  const corners: Array<[number, number]> = [
    [t0, u0],
    [t1, u1],
    [t1, l1],
    [t0, l0],
  ];
  ctx.beginPath();
  corners.forEach(([t, v], i) => {
    const [sx, sy] = toScreen(viewport, spec.variable, ...mirror(t, v), width, height);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSweepStrip(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  pieces: SolidPiece[],
  t: number,
  width: number,
  height: number,
): void {
  const piece = findPiece(pieces, t);
  if (!piece) return;
  const palette = canvasPalette();
  const baseline = baselineFor(spec);
  const span = Math.max(1e-6, piece.b - piece.a);
  const halfWidth = span * 0.006;

  drawStripAt(ctx, viewport, spec, piece, t, halfWidth, baseline, palette.highlight, width, height);

  const mirror = spec.method === 'disk-washer' ? mirrorFor(spec) : null;
  if (mirror) {
    drawStripAt(
      ctx,
      viewport,
      spec,
      piece,
      t,
      halfWidth,
      baseline,
      palette.highlightMirror,
      width,
      height,
      mirror,
    );
    const layout = washerRadiusLayout(viewport, spec, piece, t, halfWidth, width, height);
    if (layout) drawRadiusLabels(ctx, layout);
  }

  if (spec.method === 'shell' && spec.axis) {
    const mirrored = 2 * spec.axis.value - t;
    if (mirrored >= piece.a && mirrored <= piece.b) {
      drawStripAt(
        ctx,
        viewport,
        spec,
        piece,
        mirrored,
        halfWidth,
        baseline,
        palette.highlightMirror,
        width,
        height,
      );
    }
  }
}

/**
 * Draws the 2D region for the "solids by integration" tool: the filled region per piece (in the
 * curves' own colors, low alpha), its dashed mirror across the axis of revolution, the dashed
 * axis with its label, and — when `sweepT` is set — the representative strip at t with its mirror
 * across the axis (disk-washer strips also get their R / r radius segments).
 */
export function drawSolidRegion(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  pieces: SolidPiece[],
  sweepT: number | null,
  width: number,
  height: number,
): void {
  const baseline = baselineFor(spec);
  const mirror = mirrorFor(spec);
  for (const piece of pieces) {
    drawPieceFill(ctx, viewport, spec, piece, baseline, width, height);
    if (mirror) drawPieceMirror(ctx, viewport, spec, piece, baseline, mirror, width, height);
  }

  if (spec.axis) {
    drawAxisLine(ctx, viewport, spec.axis, width, height);
  }

  if (sweepT !== null && Number.isFinite(sweepT)) {
    drawSweepStrip(ctx, viewport, spec, pieces, sweepT, width, height);
  }
}
