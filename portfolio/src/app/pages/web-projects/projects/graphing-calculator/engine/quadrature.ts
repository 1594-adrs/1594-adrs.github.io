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

import { bisectSignChange } from './numeric-utils';

/**
 * - 'ok': converged (or the residual error estimate is below INACCURATE_REL of the result).
 * - 'divergent' / 'undefined': see the module comment; `badPoint` locates the trouble.
 * - 'inaccurate': evaluations ran out (or the panels hit the minimum width) with the error
 *   estimate still above the tolerance; `value` is a best effort and `error` says how far off
 *   it may be (e.g. sin(1000x) over a wide interval, a very slowly converging endpoint).
 */
export type QuadratureStatus = 'ok' | 'divergent' | 'undefined' | 'inaccurate';

export interface QuadratureResult {
  value: number;
  error: number;
  status: QuadratureStatus;
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
// The summed K15-G7 error is a conservative estimate (it overstates the true error), so a result
// is only reported 'inaccurate' when the leftover error exceeds max(tol, INACCURATE_REL) relative
// to max(1, |value|). 1e-5 keeps ordinary endpoint-singularity integrals (1/sqrt(x), ln x, which
// stall around 1e-6 within the default budget) 'ok' while flagging real failures (sin(1000x)
// over [0, 10] reports an error of 0.38 on a value of 2.5e-4).
const INACCURATE_REL = 1e-5;
// Intervals wider than this get extra panel boundaries at 0 and +-10^k (see interestPoints).
const WIDE_SPAN = 1e3;
// Pole probing (see probePoles): how many of the strongest sign-change candidates are
// bisected, and the minimum growth exponent p (|f| ~ |x - c|^-p) treated as non-integrable.
const MAX_POLE_PROBES = 8;
const POLE_EXPONENT = 0.95;

interface Panel {
  a: number;
  b: number;
  kronrod: number;
  error: number;
  nonFiniteCount: number;
  sawInfinity: boolean;
  maxFiniteAbs: number;
  stagnant: number;
  /** Strongest sign change between two adjacent finite nodes: a pole candidate (see probePoles). */
  flipLo: number;
  flipHi: number;
  flipScore: number;
}

// All 15 Kronrod nodes in ascending order with their Kronrod weight and (for the 7 shared
// nodes) their Gauss weight, so each panel is sampled once, left to right.
interface Node {
  xi: number;
  wk: number;
  wg: number;
}
const NODES: Node[] = (() => {
  const nodes: Node[] = [];
  for (let idx = 0; idx < 7; idx++) {
    const shared = GAUSS_SHARED_INDICES.indexOf(idx);
    nodes.push({ xi: -XGK[idx], wk: WGK[idx], wg: shared >= 0 ? WG[shared] : 0 });
  }
  nodes.push({ xi: 0, wk: WGK[7], wg: WG[3] });
  for (let idx = 6; idx >= 0; idx--) {
    const shared = GAUSS_SHARED_INDICES.indexOf(idx);
    nodes.push({ xi: XGK[idx], wk: WGK[idx], wg: shared >= 0 ? WG[shared] : 0 });
  }
  return nodes;
})();

function evalPanel(f: (x: number) => number, a: number, b: number): Panel {
  const center = 0.5 * (a + b);
  const halfLength = 0.5 * (b - a);
  let kronrod = 0;
  let gauss = 0;
  let nonFiniteCount = 0;
  let sawInfinity = false;
  let maxFiniteAbs = 0;
  let flipLo = NaN;
  let flipHi = NaN;
  let flipScore = 0;
  let prevX = NaN;
  let prevV = NaN; // NaN when the previous node was non-finite

  for (const node of NODES) {
    const x = center + halfLength * node.xi;
    let v: number;
    try {
      v = f(x);
    } catch {
      v = NaN;
    }
    let used = v;
    if (!Number.isFinite(v)) {
      nonFiniteCount++;
      if (v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY) sawInfinity = true;
      used = 0;
      v = NaN;
    } else {
      if (Math.abs(v) > maxFiniteAbs) maxFiniteAbs = Math.abs(v);
      if (Math.abs(v) > BLOWUP_ABS) sawInfinity = true;
      if (prevV * v < 0) {
        const score = Math.min(Math.abs(prevV), Math.abs(v));
        if (score > flipScore) {
          flipScore = score;
          flipLo = prevX;
          flipHi = x;
        }
      }
    }
    kronrod += node.wk * used;
    gauss += node.wg * used;
    prevX = x;
    prevV = v;
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
    flipLo,
    flipHi,
    flipScore,
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

/**
 * Extra panel boundaries for very wide intervals: 0 and +-10^k (k >= -2) inside (a, b). A function
 * that lives at a scale far smaller than the interval (1/(1+x^2) or exp(-x^2) over [-1e5, 1e5])
 * would otherwise be sampled only at a few far-away nodes of one huge panel, which looks smooth
 * and "converged" while missing all the mass near the origin. Log-spaced panels keep every scale
 * between 0.01 and the interval size resolved. Not graded (adaptive bisection takes it from there).
 */
function interestPoints(a: number, b: number): number[] {
  if (b - a <= WIDE_SPAN) return [];
  const points: number[] = [];
  if (a < 0 && b > 0) points.push(0);
  const maxExp = Math.ceil(Math.log10(Math.max(Math.abs(a), Math.abs(b))));
  for (let k = -2; k <= maxExp; k++) {
    const p = Math.pow(10, k);
    if (p > a && p < b) points.push(p);
    if (-p > a && -p < b) points.push(-p);
  }
  return points;
}

function buildInitialBoundaries(a: number, b: number, breakpoints: number[]): number[] {
  const inner = breakpoints.filter((p) => p > a && p < b).sort((x, y) => x - y);
  const segments = [a, ...inner, b];
  const all = new Set<number>();
  for (let i = 0; i < segments.length - 1; i++) {
    for (const p of gradedBoundaries(segments[i], segments[i + 1])) all.add(p);
  }
  for (const p of interestPoints(a, b)) all.add(p);
  return Array.from(all).sort((x, y) => x - y);
}

/**
 * Looks for non-integrable poles that sit *between* nodes. No Gauss-Kronrod node lands exactly on
 * a pole, so every sample stays finite; and for an odd pole (tan near pi/2, 1/(x-c)) the two
 * sides cancel so the stagnation heuristic never fires either. The strongest sign changes
 * between adjacent finite nodes are bisected onto the discontinuity c, and |f| is compared at
 * two distances from it: |f| ~ d^-p with p >= POLE_EXPONENT means the integral diverges, while a
 * plain zero crossing (|f| shrinks towards c), a jump (p = 0) or an integrable cusp such as
 * 1/cbrt(x) (p = 1/3) is left alone. Returns the pole location, if any.
 */
function probePoles(f: (x: number) => number, panels: Panel[]): number | undefined {
  const candidates = panels
    .filter((p) => p.flipScore > 0)
    .sort((p, q) => q.flipScore - p.flipScore)
    .slice(0, MAX_POLE_PROBES);

  const safe = (x: number): number => {
    try {
      return f(x);
    } catch {
      return NaN;
    }
  };

  for (const panel of candidates) {
    const c = bisectSignChange(safe, panel.flipLo, panel.flipHi);
    if (c === null) continue;
    // Probe distances: relative to the panel but never closer to c than c's own resolution allows
    // (panels around a pole are refined down to ~1e-9 of the interval).
    const d2 = Math.max(
      (panel.b - panel.a) * 1e-4,
      1e5 * Number.EPSILON * Math.max(1, Math.abs(c)),
    );
    const d1 = 100 * d2;
    for (const side of [1, -1]) {
      const v1 = Math.abs(safe(c + side * d1));
      const v2 = Math.abs(safe(c + side * d2));
      if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 === 0) continue;
      if (v2 <= v1 * 1.5) continue;
      const p = Math.log(v2 / v1) / Math.log(d1 / d2);
      if (p >= POLE_EXPONENT) return c;
    }
  }
  return undefined;
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

  if (divergentPoint === undefined && undefinedPoint === undefined) {
    divergentPoint = probePoles(f, panels);
  }

  if (divergentPoint !== undefined) {
    return { value: total, error: totalError, status: 'divergent', badPoint: divergentPoint };
  }
  if (undefinedPoint !== undefined) {
    return { value: total, error: totalError, status: 'undefined', badPoint: undefinedPoint };
  }
  if (totalError > Math.max(tol, INACCURATE_REL) * Math.max(1, Math.abs(total))) {
    return { value: total, error: totalError, status: 'inaccurate' };
  }
  return { value: total, error: totalError, status: 'ok' };
}
