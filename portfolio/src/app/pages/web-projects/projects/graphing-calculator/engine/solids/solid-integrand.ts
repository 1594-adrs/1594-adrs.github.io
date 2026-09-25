import { findIntersections } from '../intersection-finder';
import type { SolidPiece, SolidSpec } from './solid.types';

/**
 * Pure geometry for the "solids by integration" feature: splitting [a, b]
 * into pieces with a fixed upper/lower ordering, and turning those pieces
 * into a single cross-sectional-area function A(t) (or shell lateral-area
 * function) usable by adaptive quadrature.
 */

const EPS = 1e-9;

function safeEval(fn: (t: number) => number, t: number): number {
  try {
    return fn(t);
  } catch {
    return NaN;
  }
}

/** Baseline value the missing boundary takes when a spec has a single curve. */
function baselineValue(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

function singleCurvePiece(spec: SolidSpec): SolidPiece {
  const { a, b } = spec;
  const baseline = baselineValue(spec);
  const mid = 0.5 * (a + b);
  const v = safeEval(spec.curves[0].fn, mid);
  // Ties (v === baseline, or v is non-finite) default to the curve being the
  // lower boundary; for disk-washer this is immaterial since the area only
  // depends on |value - axis|, and for shell/cross-section the sign of
  // (curve - baseline) still comes out right either way.
  const curveIsUpper = Number.isFinite(v) ? v > baseline : false;
  return curveIsUpper
    ? { a, b, upperIndex: 0, lowerIndex: null }
    : { a, b, upperIndex: null, lowerIndex: 0 };
}

function dedupeSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (out.length === 0 || v - out[out.length - 1] > EPS) out.push(v);
  }
  return out;
}

function twoCurvePieces(spec: SolidSpec): SolidPiece[] {
  const { a, b, curves } = spec;
  const fns = curves.map((c) => c.fn);
  const span = Math.max(1e-9, b - a);
  const crossings = findIntersections(fns, a, b)
    .map((p) => p.x)
    .filter((x) => x > a + span * EPS && x < b - span * EPS)
    .sort((x, y) => x - y);
  const boundaries = [a, ...dedupeSorted(crossings), b];

  const pieces: SolidPiece[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const pa = boundaries[i];
    const pb = boundaries[i + 1];
    if (pb - pa <= span * EPS) continue;

    const mid = 0.5 * (pa + pb);
    const v0 = safeEval(fns[0], mid);
    const v1 = safeEval(fns[1], mid);
    // If the midpoint sample is inconclusive (non-finite on one side), fall
    // back to the default ordering (curve 0 upper) - the quadrature will
    // surface the underlying domain issue regardless of which side we pick.
    const curve1IsUpper = Number.isFinite(v0) && Number.isFinite(v1) ? v1 > v0 : false;
    pieces.push(
      curve1IsUpper
        ? { a: pa, b: pb, upperIndex: 1, lowerIndex: 0 }
        : { a: pa, b: pb, upperIndex: 0, lowerIndex: 1 },
    );
  }
  return pieces;
}

/**
 * Splits [spec.a, spec.b] into pieces with a fixed upper/lower curve
 * ordering: at interior crossings of the two curves for a two-curve spec, or
 * a single piece (ordered against the baseline) for a one-curve spec.
 */
export function computePieces(spec: SolidSpec): SolidPiece[] {
  if (spec.curves.length === 0) return [];
  if (spec.curves.length === 1) return [singleCurvePiece(spec)];
  return twoCurvePieces(spec);
}

function findPieceIndex(pieces: SolidPiece[], t: number): number {
  if (pieces.length === 0) return -1;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (t >= p.a - EPS && t <= p.b + EPS) return i;
  }
  // Outside every piece by more than EPS (can happen at the extreme edge of
  // floating-point rounding during quadrature) - clamp to the nearest piece.
  return t < pieces[0].a ? 0 : pieces.length - 1;
}

function boundaryValue(spec: SolidSpec, index: number | null, t: number, baseline: number): number {
  if (index === null) return baseline;
  return safeEval(spec.curves[index].fn, t);
}

/**
 * Builds A(t): the cross-sectional area (disk/washer/cross-section) or the
 * shell's lateral area 2π·|t−k|·(U−L), valid across the whole [a, b] domain
 * (not just one piece) so it also serves as the sweep readout.
 *
 * disk-washer: R = max(|U−k|, |L−k|), r = min(|U−k|, |L−k|) when the axis
 * value k lies outside [L, U]; when k lies inside [L, U] the rotated region
 * overlaps itself (the swept solid is the union of the two half-solids), so
 * r is taken as 0 rather than double-subtracting - this is a deliberate
 * modelling choice, not a limitation of the quadrature.
 */
export function sliceArea(spec: SolidSpec, pieces: SolidPiece[]): (t: number) => number {
  const { method, shape, heightRatio } = spec;
  const k = spec.axis?.value ?? 0;
  const baseline = baselineValue(spec);

  return (t: number): number => {
    const idx = findPieceIndex(pieces, t);
    if (idx < 0) return NaN;
    const piece = pieces[idx];

    if (method === 'disk-washer') {
      const U = boundaryValue(spec, piece.upperIndex, t, baseline);
      const L = boundaryValue(spec, piece.lowerIndex, t, baseline);
      if (!Number.isFinite(U) || !Number.isFinite(L)) return NaN;
      const dU = Math.abs(U - k);
      const dL = Math.abs(L - k);
      const R = Math.max(dU, dL);
      const axisOutside = k < Math.min(L, U) || k > Math.max(L, U);
      const r = axisOutside ? Math.min(dU, dL) : 0;
      return Math.PI * (R * R - r * r);
    }

    if (method === 'shell') {
      const U = boundaryValue(spec, piece.upperIndex, t, 0);
      const L = boundaryValue(spec, piece.lowerIndex, t, 0);
      if (!Number.isFinite(U) || !Number.isFinite(L)) return NaN;
      return 2 * Math.PI * Math.abs(t - k) * (U - L);
    }

    // cross-section
    const U = boundaryValue(spec, piece.upperIndex, t, 0);
    const L = boundaryValue(spec, piece.lowerIndex, t, 0);
    if (!Number.isFinite(U) || !Number.isFinite(L)) return NaN;
    const s = U - L;
    switch (shape) {
      case 'square':
        return s * s;
      case 'rectangle':
        return (heightRatio ?? 1) * s * s;
      case 'equilateral-triangle':
        return (Math.sqrt(3) / 4) * s * s;
      case 'right-isosceles-leg':
        return (s * s) / 2;
      case 'right-isosceles-hypotenuse':
        return (s * s) / 4;
      case 'semicircle':
        return (Math.PI / 8) * s * s;
      default:
        return NaN;
    }
  };
}
