import { findIntersections } from '../intersection-finder';
import type { SolidPiece, SolidSpec } from './solid.types';

/**
 * Pure geometry for the "solids by integration" feature: splitting [a, b]
 * into pieces with a fixed upper/lower ordering, and turning those pieces
 * into a single cross-sectional-area function A(t) (or shell lateral-area
 * function) usable by adaptive quadrature.
 */

const EPS = 1e-9;

export function safeEval(fn: (t: number) => number, t: number): number {
  try {
    return fn(t);
  } catch {
    return NaN;
  }
}

/** Baseline value the missing boundary takes when a spec has a single curve. */
export function baselineValue(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

function dedupeSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (out.length === 0 || v - out[out.length - 1] > EPS) out.push(v);
  }
  return out;
}

/**
 * Interior breakpoints of [a, b]: every pairwise crossing between any two of
 * the (up to 5) selected curves, plus - for the shell method - the axis
 * value when it sits strictly inside the domain, so buildTerms can pick a
 * single, non-flipping sign of (t − k) per piece (see solid-formula.ts).
 */
function interiorBreakpoints(spec: SolidSpec): number[] {
  const { a, b, curves } = spec;
  const span = Math.max(1e-9, b - a);
  const points: number[] = [];

  if (curves.length >= 2) {
    const fns = curves.map((c) => c.fn);
    for (const p of findIntersections(fns, a, b)) {
      if (p.x > a + span * EPS && p.x < b - span * EPS) points.push(p.x);
    }
  }

  if (spec.method === 'shell') {
    // A single curve is ordered against the baseline y = 0: split where it crosses it so the
    // (U - L) of every piece keeps one sign (y = x^2 - 1 is negative on (-1, 1) and positive
    // outside), keeping the displayed formula terms equal to the computed integrand.
    if (curves.length === 1) {
      for (const p of findIntersections([curves[0].fn, () => 0], a, b)) {
        if (p.x > a + span * EPS && p.x < b - span * EPS) points.push(p.x);
      }
    }
    if (spec.axis) {
      const k = spec.axis.value;
      if (k > a + span * EPS && k < b - span * EPS) points.push(k);
    }
  }

  return dedupeSorted(points.sort((x, y) => x - y));
}

// Fractions of the piece width probed around its midpoint when picking the sample point for
// envelopeAt, tried in order until every curve is finite there. This matters when the exact
// midpoint coincides with a curve's own pole (e.g. spec.a/spec.b symmetric around x=0 for
// y=1/x): without probing, that curve would look non-finite for the *whole* piece and get
// silently dropped from the envelope, instead of being recognised as the boundary it is
// everywhere else in the piece.
const MID_PROBE_FRACTIONS = [0, 0.02, -0.02, 0.08, -0.08, 0.2, -0.2, 0.35, -0.35, 0.45, -0.45];

function probeMid(pa: number, pb: number, frac: number): number {
  const width = pb - pa;
  const t = 0.5 * (pa + pb) + frac * width;
  return Math.min(pb, Math.max(pa, t));
}

/**
 * Upper/lower ordering near a piece's midpoint (see MID_PROBE_FRACTIONS). A single curve is
 * ordered against the baseline (ties/non-finite default to "lower", see below); with two or
 * more curves, upperIndex/lowerIndex are the argmax/argmin among the curves' finite values
 * there (an envelope) - a curve non-finite at every probed point is excluded from the
 * envelope rather than forcing a fallback.
 */
function envelopeAt(
  spec: SolidSpec,
  pa: number,
  pb: number,
): { upperIndex: number | null; lowerIndex: number | null } {
  const { curves } = spec;

  if (curves.length === 1) {
    const baseline = baselineValue(spec);
    for (const frac of MID_PROBE_FRACTIONS) {
      const v = safeEval(curves[0].fn, probeMid(pa, pb, frac));
      if (Number.isFinite(v)) {
        return v > baseline
          ? { upperIndex: 0, lowerIndex: null }
          : { upperIndex: null, lowerIndex: 0 };
      }
    }
    // Non-finite everywhere probed: default to "lower" (see disk-washer/shell note above).
    return { upperIndex: null, lowerIndex: 0 };
  }

  let best: { upperIndex: number | null; lowerIndex: number | null } = {
    upperIndex: null,
    lowerIndex: null,
  };
  let bestCount = -1;

  for (const frac of MID_PROBE_FRACTIONS) {
    const t = probeMid(pa, pb, frac);
    let upperIndex: number | null = null;
    let lowerIndex: number | null = null;
    let maxV = -Infinity;
    let minV = Infinity;
    let count = 0;
    for (let i = 0; i < curves.length; i++) {
      const v = safeEval(curves[i].fn, t);
      if (!Number.isFinite(v)) continue;
      count++;
      if (v > maxV) {
        maxV = v;
        upperIndex = i;
      }
      if (v < minV) {
        minV = v;
        lowerIndex = i;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      best = { upperIndex, lowerIndex };
      if (count === curves.length) break;
    }
  }
  return best;
}

/**
 * Splits [spec.a, spec.b] into pieces with a fixed upper/lower curve
 * ordering: at every interior crossing between any pair of the selected
 * curves (an envelope, for 2-5 curves), plus the shell axis split (see
 * interiorBreakpoints), or a single piece (ordered against the baseline) for
 * a one-curve spec.
 */
export function computePieces(spec: SolidSpec): SolidPiece[] {
  if (spec.curves.length === 0) return [];

  const { a, b } = spec;
  const span = Math.max(1e-9, b - a);
  const boundaries = [a, ...interiorBreakpoints(spec), b];

  const pieces: SolidPiece[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const pa = boundaries[i];
    const pb = boundaries[i + 1];
    if (pb - pa <= span * EPS) continue;

    const { upperIndex, lowerIndex } = envelopeAt(spec, pa, pb);
    pieces.push({ a: pa, b: pb, upperIndex, lowerIndex });
  }
  return pieces;
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

/** [max, min] of the curves defined at t (a curve undefined there is skipped); NaN if fewer than 2. */
function envelopeValues(spec: SolidSpec, t: number): [number, number] {
  let U = -Infinity;
  let L = Infinity;
  let count = 0;
  for (const c of spec.curves) {
    const v = safeEval(c.fn, t);
    if (!Number.isFinite(v)) continue;
    count++;
    U = Math.max(U, v);
    L = Math.min(L, v);
  }
  return count >= 2 ? [U, L] : [NaN, NaN];
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
 *
 * With 3+ curves U/L are the pointwise envelope: pieces come from findIntersections' fixed
 * sampling and miss crossings of fast-oscillating curves, so their upper/lower order can be wrong.
 * With 1-2 curves every formula below is symmetric in U and L, so the piece order is enough.
 */
export function sliceArea(spec: SolidSpec, pieces: SolidPiece[]): (t: number) => number {
  const { method, shape, heightRatio } = spec;
  const k = spec.axis?.value ?? 0;
  const baseline = baselineValue(spec);

  return (t: number): number => {
    const idx = findPieceIndex(pieces, t);
    if (idx < 0) return NaN;
    const piece = pieces[idx];
    const [U, L] =
      spec.curves.length >= 3
        ? envelopeValues(spec, t)
        : [
            boundaryValue(spec, piece.upperIndex, t, baseline),
            boundaryValue(spec, piece.lowerIndex, t, baseline),
          ];
    if (!Number.isFinite(U) || !Number.isFinite(L)) return NaN;

    if (method === 'disk-washer') {
      const dU = Math.abs(U - k);
      const dL = Math.abs(L - k);
      const R = Math.max(dU, dL);
      const axisOutside = k < Math.min(L, U) || k > Math.max(L, U);
      const r = axisOutside ? Math.min(dU, dL) : 0;
      return Math.PI * (R * R - r * r);
    }

    if (method === 'shell') {
      // |U - L|: a piece's upper/lower order is fixed at its midpoint, so far from it (or on a
      // piece whose single curve crosses the baseline) U - L can go negative; a shell's lateral
      // area is never negative.
      return 2 * Math.PI * Math.abs(t - k) * Math.abs(U - L);
    }

    // cross-section
    // Every shape's area is a multiple of s^2, so the sign of U - L cannot matter here.
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
