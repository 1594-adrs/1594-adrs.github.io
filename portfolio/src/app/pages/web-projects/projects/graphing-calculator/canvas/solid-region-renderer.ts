import { Viewport } from './viewport';
import { tryEval } from './utils';
import type { AxisLine, SolidPiece, SolidSpec } from '../engine/solids/solid.types';

/** Same highlight color used by the 3D sweep slice (canvas/solid-3d/solid-3d.component.ts). */
const HIGHLIGHT_COLOR = '#ffcc00';

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

function drawPieceFill(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  spec: SolidSpec,
  piece: SolidPiece,
  baseline: number,
  width: number,
  height: number,
): void {
  const n = Math.max(20, Math.min(400, Math.round(Math.abs(piece.b - piece.a) * 40)));
  const h = (piece.b - piece.a) / n;
  const color = boundaryColor(spec, piece);

  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= n; i++) {
    const t = piece.a + i * h;
    const u = boundaryValue(spec, piece.upperIndex, t, baseline);
    if (!Number.isFinite(u)) continue;
    const [sx, sy] = toScreen(viewport, spec.variable, t, u, width, height);
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
    const [sx, sy] = toScreen(viewport, spec.variable, t, l, width, height);
    ctx.lineTo(sx, sy);
  }
  if (!started) return;
  ctx.closePath();
  ctx.fillStyle = color + '30';
  ctx.fill();
}

function drawAxisLine(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  axis: AxisLine,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = '#ffaa0088';
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
      ctx.fillStyle = '#ffaa00cc';
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
      ctx.fillStyle = '#ffaa00cc';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`x = ${axis.value}`, sx + 4, 14);
    }
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
    const [sx, sy] = toScreen(viewport, spec.variable, t, v, width, height);
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
  const baseline = baselineFor(spec);
  const span = Math.max(1e-6, piece.b - piece.a);
  const halfWidth = span * 0.006;

  drawStripAt(ctx, viewport, spec, piece, t, halfWidth, baseline, HIGHLIGHT_COLOR, width, height);

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
        HIGHLIGHT_COLOR + '80',
        width,
        height,
      );
    }
  }
}

/**
 * Draws the 2D region for the "solids by integration" tool: the filled region per piece (in the
 * curves' own colors, low alpha), the dashed axis of revolution with its label, and — when
 * `sweepT` is set — the representative strip at t (and its mirror across the axis, for shell).
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
  for (const piece of pieces) {
    drawPieceFill(ctx, viewport, spec, piece, baseline, width, height);
  }

  if (spec.axis) {
    drawAxisLine(ctx, viewport, spec.axis, width, height);
  }

  if (sweepT !== null && Number.isFinite(sweepT)) {
    drawSweepStrip(ctx, viewport, spec, pieces, sweepT, width, height);
  }
}
