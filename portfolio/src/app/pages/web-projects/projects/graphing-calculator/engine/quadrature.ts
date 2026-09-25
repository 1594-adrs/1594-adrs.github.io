/**
 * Adaptive Gauss-Kronrod (G7/K15) quadrature.
 *
 * Each panel is estimated twice: with a 7-point Gauss rule and the 15-point
 * Kronrod extension that reuses its nodes. Neither rule samples the panel's
 * endpoints, so endpoint singularities (1/sqrt(x), ln x, ...) are never
 * evaluated directly. |Kronrod - Gauss| is the panel's error estimate; the
 * globally worst panel is repeatedly bisected until the summed estimate meets
 * the tolerance (relative to the running total) or `maxEvals` is spent.
 *
 * The initial mesh is graded geometrically inward from both ends of every
 * top-level segment (between `breakpoints`). This gives the first pass fine
 * resolution near the endpoints - which is what genuine endpoint
 * singularities need - and, just as importantly, guards against "false
 * convergence" on a single very wide panel: with one panel spanning e.g.
 * [0, 1e6], every Gauss/Kronrod node could land far from where a function
 * like 1/(1+x^2) actually varies, so Kronrod and Gauss would agree on a
 * (wrong) near-zero estimate. Grading the mesh means the region near each
 * endpoint is always resolved at a fine scale before that agreement is trusted.
 *
 * Samples that come back non-finite are treated as follows: an isolated bad
 * sample (at most 2 of a panel's 15 nodes) is zeroed and the panel is refined
 * normally, since the elevated Kronrod/Gauss disagreement already drives
 * further bisection. A panel where most/all samples are non-finite is
 * bisected eagerly (bypassing the error-driven queue, since the estimate
 * can't be trusted) down to a minimum width, excising a negligible
 * neighbourhood of the trouble point; that leaf is then classified from its
 * finite samples as 'divergent' (values grow without bound / hit +-Infinity)
 * or 'undefined' (values are NaN - outside the function's real domain).
 */

export interface QuadratureResult {
  value: number;
  error: number;
  status: 'ok' | 'divergent' | 'undefined';
  badPoint?: number;
}

export interface QuadratureOptions {
  tol?: number;
  breakpoints?: number[];
  maxEvals?: number;
}

// Gauss-Kronrod G7/K15 nodes and weights on [-1, 1] (QUADPACK's dqk15 table).
// XGK[7] is the shared centre node (x = 0). XGK[1], XGK[3], XGK[5] (with their
// mirrors) are shared by both rules; the rest are Kronrod-only extension nodes.
const XGK = [
  0.9914553711208126, 0.9491079123427585, 0.8648644233597691, 0.7415311855993944,
  0.5860872354676911, 0.4058451513773972, 0.2077849550078985, 0.0,
];
const WGK = [
  0.0229353220105292, 0.0630920926299786, 0.1047900103222502, 0.1406532597155259,
  0.1690047266392679, 0.1903505780647854, 0.2044329400752989, 0.2094821410847278,
];
// Gauss 7-point weights, aligned to XGK[1], XGK[3], XGK[5], and the centre XGK[7].
const WG = [0.1294849661688697, 0.2797053914892767, 0.3818300505051889, 0.4179591836734694];
const GAUSS_SHARED_INDICES = [1, 3, 5];
const KRONROD_ONLY_INDICES = [0, 2, 4, 6];

const DEFAULT_TOL = 1e-8;
const DEFAULT_MAX_EVALS = 6000;
const NODES_PER_PANEL = 15;
const FORCE_SPLIT_THRESHOLD = 3; // non-finite samples at/above this force eager bisection
const BLOWUP_ABS = 1e8; // finite sample magnitude treated as "blowing up" near a pole
const GRADING_LEVELS = 16;
const GRADING_RATIO = 0.5;
// A panel adjacent to an integrable singularity (e.g. 1/sqrt(x)) shrinks its
// contribution by a roughly constant factor (~0.71 for a 1/sqrt(x)-like
// endpoint) every time it is halved. A non-integrable one (1/x, 1/x^2, ...)
// does not shrink at all (ratio >= 1). STAGNANT_RATIO sits comfortably
// between the two, and MAX_STAGNANT generations of "not shrinking enough"
// is the divergence signal - this is what catches cases where every
// Gauss-Kronrod node manages to avoid the exact pole (so samples stay finite)
// yet the integral still does not converge.
const STAGNANT_RATIO = 0.9;
const MAX_STAGNANT = 12;

interface Panel {
  a: number;
  b: number;
  kronrod: number;
  error: number;
  nonFiniteCount: number;
  sawInfinity: boolean;
  maxFiniteAbs: number;
  stagnant: number;
}

function evalPanel(f: (x: number) => number, a: number, b: number): Panel {
  const center = 0.5 * (a + b);
  const halfLength = 0.5 * (b - a);
  let kronrod = 0;
  let gauss = 0;
  let nonFiniteCount = 0;
  let sawInfinity = false;
  let maxFiniteAbs = 0;

  const sample = (xi: number): number => {
    const x = center + halfLength * xi;
    let v: number;
    try {
      v = f(x);
    } catch {
      v = NaN;
    }
    if (!Number.isFinite(v)) {
      nonFiniteCount++;
      if (v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY) sawInfinity = true;
      return 0;
    }
    if (Math.abs(v) > maxFiniteAbs) maxFiniteAbs = Math.abs(v);
    if (Math.abs(v) > BLOWUP_ABS) sawInfinity = true;
    return v;
  };

  const fc = sample(0);
  kronrod += WGK[7] * fc;
  gauss += WG[3] * fc;

  for (let i = 0; i < GAUSS_SHARED_INDICES.length; i++) {
    const idx = GAUSS_SHARED_INDICES[i];
    const xi = XGK[idx];
    const fPlus = sample(xi);
    const fMinus = sample(-xi);
    kronrod += WGK[idx] * (fPlus + fMinus);
    gauss += WG[i] * (fPlus + fMinus);
  }

  for (const idx of KRONROD_ONLY_INDICES) {
    const xi = XGK[idx];
    const fPlus = sample(xi);
    const fMinus = sample(-xi);
    kronrod += WGK[idx] * (fPlus + fMinus);
  }

  kronrod *= halfLength;
  gauss *= halfLength;

  return {
    a,
    b,
    kronrod,
    error: Math.abs(kronrod - gauss),
    nonFiniteCount,
    sawInfinity,
    maxFiniteAbs,
    stagnant: 0,
  };
}

/** Geometrically-graded breakpoints inward from both ends of [lo, hi]. */
function gradedBoundaries(lo: number, hi: number): number[] {
  const length = hi - lo;
  const points = new Set<number>([lo, hi]);
  let frac = 1;
  for (let i = 0; i < GRADING_LEVELS; i++) {
    frac *= GRADING_RATIO;
    const fromLo = lo + length * frac;
    const fromHi = hi - length * frac;
    if (fromLo > lo && fromLo < hi) points.add(fromLo);
    if (fromHi > lo && fromHi < hi) points.add(fromHi);
  }
  return Array.from(points).sort((x, y) => x - y);
}

function buildInitialBoundaries(a: number, b: number, breakpoints: number[]): number[] {
  const inner = breakpoints.filter((p) => p > a && p < b).sort((x, y) => x - y);
  const segments = [a, ...inner, b];
  const all = new Set<number>();
  for (let i = 0; i < segments.length - 1; i++) {
    for (const p of gradedBoundaries(segments[i], segments[i + 1])) all.add(p);
  }
  return Array.from(all).sort((x, y) => x - y);
}

export function integrateAdaptive(
  f: (x: number) => number,
  a: number,
  b: number,
  opts: QuadratureOptions = {},
): QuadratureResult {
  if (a === b) return { value: 0, error: 0, status: 'ok' };
  if (a > b) {
    const flipped = integrateAdaptive(f, b, a, opts);
    return { ...flipped, value: -flipped.value };
  }

  const tol = opts.tol ?? DEFAULT_TOL;
  const maxEvals = opts.maxEvals ?? DEFAULT_MAX_EVALS;
  const minWidth = Math.max(1e-12, (b - a) * 1e-9);

  let evals = 0;
  const panels: Panel[] = [];
  let total = 0;
  let totalError = 0;
  let divergentPoint: number | undefined;
  let undefinedPoint: number | undefined;

  const boundaries = buildInitialBoundaries(a, b, opts.breakpoints ?? []);

  interface Lineage {
    absKronrod: number;
    stagnant: number;
  }

  // Evaluates one panel and routes it: a lineage stuck at (near-)constant
  // magnitude for MAX_STAGNANT generations is a non-integrable singularity
  // ('divergent'); a panel whose samples are mostly non-finite is bisected
  // eagerly - bypassing the error-driven queue, since its estimate can't be
  // trusted - down to a negligible neighbourhood of the trouble point, then
  // classified as 'divergent' or 'undefined'; anything else is queued for
  // normal error-driven refinement.
  const processPanel = (lo: number, hi: number, parent?: Lineage): void => {
    if (evals >= maxEvals) return;
    const panel = evalPanel(f, lo, hi);
    evals += NODES_PER_PANEL;

    const absKronrod = Math.abs(panel.kronrod);
    if (parent) {
      const shrinking =
        parent.absKronrod < 1e-300 || absKronrod < STAGNANT_RATIO * parent.absKronrod;
      panel.stagnant = shrinking ? 0 : parent.stagnant + 1;
    }

    if (panel.stagnant >= MAX_STAGNANT) {
      divergentPoint ??= 0.5 * (lo + hi);
      return;
    }

    if (panel.nonFiniteCount >= FORCE_SPLIT_THRESHOLD) {
      if (hi - lo <= minWidth || evals >= maxEvals) {
        const center = 0.5 * (lo + hi);
        if (panel.sawInfinity || panel.maxFiniteAbs > BLOWUP_ABS) {
          divergentPoint ??= center;
        } else {
          undefinedPoint ??= center;
        }
        return;
      }

      const mid = 0.5 * (lo + hi);
      const lineage: Lineage = { absKronrod, stagnant: panel.stagnant };
      processPanel(lo, mid, lineage);
      processPanel(mid, hi, lineage);
      return;
    }

    panels.push(panel);
    total += panel.kronrod;
    totalError += panel.error;
  };

  for (let i = 0; i < boundaries.length - 1; i++) {
    processPanel(boundaries[i], boundaries[i + 1]);
  }

  while (evals < maxEvals && totalError > tol * Math.max(1, Math.abs(total))) {
    let worstIdx = -1;
    let worstError = -1;
    for (let i = 0; i < panels.length; i++) {
      if (panels[i].error > worstError) {
        worstError = panels[i].error;
        worstIdx = i;
      }
    }
    if (worstIdx < 0) break;

    const panel = panels[worstIdx];
    if (panel.b - panel.a <= minWidth) break;

    panels.splice(worstIdx, 1);
    total -= panel.kronrod;
    totalError -= panel.error;

    const mid = 0.5 * (panel.a + panel.b);
    const lineage: Lineage = { absKronrod: Math.abs(panel.kronrod), stagnant: panel.stagnant };
    processPanel(panel.a, mid, lineage);
    processPanel(mid, panel.b, lineage);
  }

  if (divergentPoint !== undefined) {
    return { value: total, error: totalError, status: 'divergent', badPoint: divergentPoint };
  }
  if (undefinedPoint !== undefined) {
    return { value: total, error: totalError, status: 'undefined', badPoint: undefinedPoint };
  }
  return { value: total, error: totalError, status: 'ok' };
}
