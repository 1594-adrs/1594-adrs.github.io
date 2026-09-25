import { validateSolidSpec } from './solid-validation';
import type { SolidPiece, SolidSpec } from './solid.types';

/**
 * Total boundary surface area of a solid of revolution (disk-washer or
 * shell only; `null` for 'cross-section').
 *
 * The boundary of the 2D region is: the upper curve arc, the lower curve arc
 * (or the baseline, when a piece has only one selected curve), and the two
 * straight end segments at the global t = a and t = b. Revolving each part
 * around the axis and summing gives the solid's full surface:
 *
 * - Curve/baseline arcs: a derivative-free frustum sum. The arc is sampled
 *   into a polyline (t_i, c(t_i)); each consecutive pair (t_i, c_i) and
 *   (t_{i+1}, c_{i+1}) revolves into a conical frustum of radii r_i, r_{i+1}
 *   and slant height √(Δt² + Δc²), lateral area π(r_i + r_{i+1})·slant -
 *   exact for a straight segment, so no derivative is ever taken (immune to
 *   a vertical tangent, e.g. sqrt(1-x²) at x=±1, which would blow up any
 *   derivative-based ds = √(1+c'²) dt estimate right at the domain edge).
 *   Segments are refined adaptively (bisect wherever the one-segment vs.
 *   two-half-segment frustum estimate still disagrees beyond a relative
 *   tolerance of the arc's overall scale), so smooth arcs stay cheap while a
 *   singular endpoint gets bisected down until its local contribution
 *   converges. Radius: disk-washer r = |c(t) − k| (so a baseline, which is
 *   exactly the axis for disk-washer, contributes 0 without any
 *   special-casing beyond skipping the sum outright); shell r = |t − k| (so
 *   a baseline - the t-axis itself, not generally on the axis of revolution
 *   - can contribute a non-zero flat annulus/disk).
 * - End segments at t = a and t = b: disk-washer revolves a perpendicular
 *   segment into a flat annulus/disk, π|r_U² − r_L²|; shell revolves a
 *   parallel segment into a cylinder's lateral surface, 2π|t − k|·(U − L).
 *   An end where the pieces already meet (U = L, e.g. two curves crossing
 *   at a or b) contributes 0 automatically, without special-casing.
 *
 * Returns null for 'cross-section', when the axis cuts the region (the
 * solid overlaps itself and the "total surface" isn't well defined), or
 * when a boundary curve is undefined somewhere in a piece.
 */
export function computeSurfaceArea(spec: SolidSpec, pieces: SolidPiece[]): number | null {
  if (spec.method === 'cross-section') return null;
  if (!spec.axis) return null;
  if (pieces.length === 0) return null;
  if (validateSolidSpec(spec).some((issue) => issue.code === 'axis-inside-region')) return null;

  const k = spec.axis.value;
  const isShell = spec.method === 'shell';

  let total = 0;
  for (const piece of pieces) {
    const upper = lateralArc(spec, piece.upperIndex, piece.a, piece.b, k, isShell);
    const lower = lateralArc(spec, piece.lowerIndex, piece.a, piece.b, k, isShell);
    if (!upper.ok || !lower.ok) return null;
    total += upper.value + lower.value;
  }

  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  const capA = endCapArea(spec, first, spec.a, k, isShell);
  const capB = endCapArea(spec, last, spec.b, k, isShell);
  if (!Number.isFinite(capA) || !Number.isFinite(capB)) return null;
  total += capA + capB;

  return total;
}

function safeEval(fn: (t: number) => number, t: number): number {
  try {
    return fn(t);
  } catch {
    return NaN;
  }
}

function baselineValue(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

interface ArcResult {
  value: number;
  ok: boolean;
}

interface ArcSample {
  t: number;
  c: number;
  r: number;
}

/** Frustum lateral area between two arc samples: π(r0 + r1)·√(Δt² + Δc²). Exact for a
 *  straight segment between the samples - the true arc's curvature is the only error source,
 *  so refining (see `refine` below) drives it to zero without ever taking a derivative. */
function frustum(s0: ArcSample, s1: ArcSample): number {
  const dt = s1.t - s0.t;
  const dc = s1.c - s0.c;
  return Math.PI * (s0.r + s1.r) * Math.sqrt(dt * dt + dc * dc);
}

// Uniform seed segments before adaptive refinement kicks in (so a feature localised well
// inside the domain, not just at an endpoint, still gets a fair starting resolution).
const SEED_SEGMENTS = 32;
// Local relative tolerance, against the arc's own rough scale (see computeArcSum) - tight
// enough for recognizeExact's 1e-9 tolerance with comfortable margin, cheap enough (a few
// hundred µs even for an endpoint slope singularity) to stay well under the ~5ms budget.
const REL_TOL = 1e-13;
const MAX_DEPTH = 60;
const MAX_EVALS = 200_000;

/** Sum of the (adaptively refined) frustum areas of a boundary's polyline over [pa, pb];
 *  NaN if the curve is non-finite anywhere it's sampled. */
function computeArcSum(
  c: (t: number) => number,
  r: (t: number, cv: number) => number,
  pa: number,
  pb: number,
): number {
  const sample = (t: number): ArcSample | null => {
    const cv = safeEval(c, t);
    if (!Number.isFinite(cv)) return null;
    const rv = r(t, cv);
    if (!Number.isFinite(rv)) return null;
    return { t, c: cv, r: rv };
  };

  const seeds: (ArcSample | null)[] = new Array(SEED_SEGMENTS + 1);
  for (let i = 0; i <= SEED_SEGMENTS; i++) {
    const t = i === 0 ? pa : i === SEED_SEGMENTS ? pb : pa + ((pb - pa) * i) / SEED_SEGMENTS;
    seeds[i] = sample(t);
  }
  if (seeds.some((s) => s === null)) return NaN;

  let rough = 0;
  for (let i = 0; i < SEED_SEGMENTS; i++) rough += frustum(seeds[i]!, seeds[i + 1]!);
  const scale = Math.max(1e-12, Math.abs(rough));

  let evals = SEED_SEGMENTS + 1;
  let failed = false;

  const refine = (s0: ArcSample, s1: ArcSample, depth: number): number => {
    const value = frustum(s0, s1);
    if (failed || depth >= MAX_DEPTH || evals >= MAX_EVALS) return value;
    const sm = sample(0.5 * (s0.t + s1.t));
    evals++;
    if (!sm) {
      failed = true;
      return value;
    }
    const refined = frustum(s0, sm) + frustum(sm, s1);
    if (Math.abs(refined - value) <= REL_TOL * scale) return refined;
    return refine(s0, sm, depth + 1) + refine(sm, s1, depth + 1);
  };

  let total = 0;
  for (let i = 0; i < SEED_SEGMENTS; i++) total += refine(seeds[i]!, seeds[i + 1]!, 0);

  return failed ? NaN : total;
}

/** Surface of revolution of one boundary (curve or baseline) over [pa, pb] - the frustum
 *  formula's π(r0 + r1) already carries the 2π·(average radius) factor, so no extra
 *  scaling is needed here. */
function lateralArc(
  spec: SolidSpec,
  index: number | null,
  pa: number,
  pb: number,
  k: number,
  isShell: boolean,
): ArcResult {
  // disk-washer's baseline is exactly the axis (r ≡ 0 everywhere) - skip the sum rather
  // than run it for a trivially-zero result.
  if (!isShell && index === null) return { value: 0, ok: true };

  const c: (t: number) => number =
    index === null ? () => baselineValue(spec) : spec.curves[index].fn;
  const radiusOf = (t: number, cv: number): number =>
    isShell ? Math.abs(t - k) : Math.abs(cv - k);

  const value = computeArcSum(c, radiusOf, pa, pb);
  return { value, ok: Number.isFinite(value) };
}

function boundaryValueAt(spec: SolidSpec, index: number | null, t: number): number {
  return index === null ? baselineValue(spec) : safeEval(spec.curves[index].fn, t);
}

/** Surface swept by the straight end segment at a global bound (t = a or t = b). */
function endCapArea(
  spec: SolidSpec,
  piece: SolidPiece,
  t: number,
  k: number,
  isShell: boolean,
): number {
  const U = boundaryValueAt(spec, piece.upperIndex, t);
  const L = boundaryValueAt(spec, piece.lowerIndex, t);
  if (!Number.isFinite(U) || !Number.isFinite(L)) return NaN;

  if (isShell) {
    return 2 * Math.PI * Math.abs(t - k) * Math.abs(U - L);
  }
  const rU = Math.abs(U - k);
  const rL = Math.abs(L - k);
  return Math.PI * Math.abs(rU * rU - rL * rL);
}
