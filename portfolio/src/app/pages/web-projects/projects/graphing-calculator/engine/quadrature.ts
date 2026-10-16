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
 *
 * Singularities are then settled by their local power law |f| ~ A|x - c|^-p rather than by how
 * the quadrature behaves near them (x^-0.999 converges, 1/x does not, and both look alike to the
 * panels). A suspect point - a stagnant lineage, a sign change that bisects onto a jump, or the
 * worst panel of a pass that did not converge - is located (bisection / golden-section peak of
 * |f|), and p is estimated per side from log|f| vs log|x - c| over three decades very close to c
 * (classifySide). p >= 1 (minus P_MARGIN) is 'divergent'; an integrable p becomes a breakpoint
 * whose innermost strip is integrated analytically (f(c + d) d / (1 - p)) and whose neighbourhood
 * gets a geometric mesh, and the integral is recomputed. Points whose behaviour is not a clean
 * power law (ln x, 1/(x ln x), oscillation) keep the verdict of the plain pass.
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
// How many of the strongest sign-change candidates are bisected onto a possible pole (signJumps).
const MAX_POLE_PROBES = 8;
// Singularity classification (classifySide): probe distances grow by SCALE_STEP; slopes of a
// clean power law agree within CLEAN_TOL; exponents below P_MIN mean |f| stays bounded.
const SCALE_STEP = 8;
const CLEAN_TOL = 1e-4;
const P_MIN = 0.01;
// shortcut: a clean exponent p >= 1 - P_MARGIN is reported 'divergent', so x^-(1 - 1e-6)
// (integral 1e6) counts as divergent; p is estimated to ~1e-8, so the margin could shrink to
// ~1e-7 if such near-critical integrands ever matter.
const P_MARGIN = 1e-5;
// At most this many singular points are classified and re-integrated per call.
const MAX_REPAIRS = 4;
// A located point this close (relative to b - a) to an already handled one is the same point.
const KNOWN_RADIUS = 1e-6;
// A located peak this close (relative to the search window) to a or b is snapped onto it.
const SNAP_REL = 1e-6;
const GOLDEN_STEPS = 120;

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

/** Sign changes between adjacent finite nodes - pole candidates - bisected onto the jump. */
function signJumps(f: (x: number) => number, panels: Panel[]): number[] {
  const safe = (x: number) => safeEval(f, x);
  return panels
    .filter((p) => p.flipScore > 0)
    .sort((p, q) => q.flipScore - p.flipScore)
    .slice(0, MAX_POLE_PROBES)
    .map((p) => bisectSignChange(safe, p.flipLo, p.flipHi))
    .filter((c): c is number => c !== null);
}

function safeEval(f: (x: number) => number, x: number): number {
  try {
    return f(x);
  } catch {
    return NaN;
  }
}

/** Golden-section search for the point of [lo, hi] where |f| peaks (non-finite counts as +Inf). */
function locatePeak(f: (x: number) => number, lo: number, hi: number): number {
  const g = (x: number) => {
    const v = Math.abs(safeEval(f, x));
    return Number.isNaN(v) ? Infinity : v;
  };
  const r = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - r * (hi - lo);
  let x2 = lo + r * (hi - lo);
  let g1 = g(x1);
  let g2 = g(x2);
  for (let i = 0; i < GOLDEN_STEPS && x1 < x2; i++) {
    if (g1 >= g2) {
      hi = x2;
      x2 = x1;
      g2 = g1;
      x1 = hi - r * (hi - lo);
      g1 = g(x1);
    } else {
      lo = x1;
      x1 = x2;
      g1 = g2;
      x2 = lo + r * (hi - lo);
      g2 = g(x2);
    }
  }
  return g1 >= g2 ? x1 : x2;
}

/** The analytic piece of the integral over [lo, hi], the width-d strip next to singular point c. */
interface Tail {
  c: number;
  dir: 1 | -1;
  /** Distance from c to the next fence on this side (bounds the geometric mesh). */
  h: number;
  lo: number;
  hi: number;
  value: number;
  error: number;
}

interface Singularity {
  c: number;
  divergent: boolean;
  tails: Tail[];
}

type Side = { kind: 'bounded' | 'unknown' } | { kind: 'power'; p: number; tail: Tail };

/**
 * Local power-law test on one side of c: |f(c + dir*d)| at d = d0 * 8^k (k = 0..3) gives three
 * log-log slopes. A clean power law A*d^-p (times any smooth factor) has slopes that agree to
 * O(d); log-type behaviour (ln d, 1/(d ln d), ...) drifts by ~ln(8)/ln(d)^2 ~ 5e-3 per scale and
 * is reported 'unknown'. p is Richardson-extrapolated from the two finest slopes (removes the
 * O(d) term of a smooth factor). p < P_MIN means |f| stays bounded (jump, zero, smooth point).
 */
function classifySide(f: (x: number) => number, c: number, dir: 1 | -1, h: number): Side {
  // Relative to |c| too: the float c is only within an ulp of the true pole (e.g. pi/2).
  const base = Math.min(Math.max(1e-9 * h, 1e-8 * Math.abs(c)), 1e-6 * h);
  const d: number[] = [];
  const v: number[] = [];
  let f0 = NaN;
  let x0 = NaN;
  for (let k = 0; k < 4; k++) {
    const x = c + dir * base * SCALE_STEP ** k;
    const fx = safeEval(f, x);
    const dx = Math.abs(x - c);
    if (!Number.isFinite(fx) || fx === 0 || dx === 0) return { kind: 'unknown' };
    if (k === 0) {
      f0 = fx;
      x0 = x;
    }
    d.push(dx);
    v.push(Math.abs(fx));
  }
  const s = [0, 1, 2].map((k) => Math.log(v[k] / v[k + 1]) / Math.log(d[k + 1] / d[k]));
  if (Math.abs(s[0] - s[1]) > CLEAN_TOL || Math.abs(s[1] - s[2]) > SCALE_STEP * CLEAN_TOL) {
    return { kind: 'unknown' };
  }
  const p = s[0] + (s[0] - s[1]) / (SCALE_STEP - 1);
  if (p < P_MIN) return { kind: 'bounded' };
  // Integral of A t^-p over [0, d] = A d^(1-p) / (1-p) = f(c +- d) * d / (1-p); used only if p < 1.
  const value = (f0 * d[0]) / (1 - p);
  const error =
    Math.abs(value) *
    (Math.abs(s[0] - s[1]) + 1e-15) *
    (1 / Math.abs(1 - p) + Math.abs(Math.log(d[0] / h)));
  const [lo, hi] = dir > 0 ? [c, x0] : [x0, c];
  return { kind: 'power', p, tail: { c, dir, h, lo, hi, value, error } };
}

/** Classifies c from both sides; null when neither side is a clean power-law blow-up. */
function classifyPoint(
  f: (x: number) => number,
  c: number,
  a: number,
  b: number,
  fences: number[],
): Singularity | null {
  let left = a;
  let right = b;
  for (const q of fences) {
    if (q < c && q > left) left = q;
    if (q > c && q < right) right = q;
  }
  let divergent = false;
  const tails: Tail[] = [];
  const sides: Array<[1 | -1, number]> = [
    [-1, c - left],
    [1, right - c],
  ];
  for (const [dir, h] of sides) {
    if (!(h > 0)) continue;
    const side = classifySide(f, c, dir, h);
    if (side.kind !== 'power') continue;
    if (side.p >= 1 - P_MARGIN) divergent = true;
    else tails.push(side.tail);
  }
  return divergent || tails.length > 0 ? { c, divergent, tails } : null;
}

interface Pass {
  total: number;
  totalError: number;
  tailError: number;
  panels: Panel[];
  divergentPoint?: number;
  undefinedPoint?: number;
  /** Divergence seen directly in the samples (force-split leaf), not inferred. */
  forced: boolean;
  /** First panel whose lineage stopped shrinking (see STAGNANT_RATIO). */
  stagnant?: [number, number];
}

/**
 * One adaptive Gauss-Kronrod run. Known singular points split the interval; next to each one
 * the width-d strip is replaced by its analytic tail and the mesh is graded geometrically
 * (c + d*2^k), so every remaining panel sits at least its own width away from the singularity.
 */
function runPass(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number,
  maxEvals: number,
  breakpoints: number[],
  singular: Singularity[],
): Pass {
  const minWidth = Math.max(1e-12, (b - a) * 1e-9);
  let evals = 0;
  const panels: Panel[] = [];
  let total = 0;
  let totalError = 0;
  let tailError = 0;
  let divergentPoint: number | undefined;
  let undefinedPoint: number | undefined;
  let forced = false;
  let stagnant: [number, number] | undefined;

  const tails = singular.flatMap((s) => s.tails);
  const points = new Set(
    buildInitialBoundaries(a, b, [...breakpoints, ...singular.map((s) => s.c)]),
  );
  for (const t of tails) {
    const d = t.hi - t.lo;
    for (let step = 2 * d; step < t.h * GRADING_RATIO ** GRADING_LEVELS; step *= 2) {
      points.add(t.c + t.dir * step);
    }
  }
  for (const t of tails) {
    for (const x of points) if (x > t.lo && x < t.hi) points.delete(x);
    points.add(t.lo);
    points.add(t.hi);
  }
  const boundaries = [...points].sort((x, y) => x - y);
  const tailAt = new Map(tails.map((t) => [t.lo, t]));

  interface Lineage {
    absKronrod: number;
    stagnant: number;
  }

  // Evaluates one panel and routes it: a lineage stuck at (near-)constant
  // magnitude for MAX_STAGNANT generations is a suspected non-integrable
  // singularity (confirmed or overruled by classifyPoint); a panel whose samples
  // are mostly non-finite is bisected eagerly - bypassing the error-driven queue,
  // since its estimate can't be trusted - down to a negligible neighbourhood of
  // the trouble point, then classified as 'divergent' or 'undefined'; anything
  // else is queued for normal error-driven refinement.
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
      stagnant ??= [lo, hi];
      return;
    }

    if (panel.nonFiniteCount >= FORCE_SPLIT_THRESHOLD) {
      if (hi - lo <= minWidth || evals >= maxEvals) {
        const center = 0.5 * (lo + hi);
        if (panel.sawInfinity || panel.maxFiniteAbs > BLOWUP_ABS) {
          divergentPoint ??= center;
          forced = true;
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
    const tail = tailAt.get(boundaries[i]);
    if (tail && tail.hi === boundaries[i + 1]) {
      total += tail.value;
      tailError += tail.error;
      continue;
    }
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

  return {
    total,
    totalError,
    tailError,
    panels,
    divergentPoint,
    undefinedPoint,
    forced,
    stagnant,
  };
}

/**
 * The next singular point worth classifying after a pass, in order of evidence: a stagnant
 * lineage, a sign change that bisects onto a jump (odd poles cancel, so nothing else sees them),
 * then - if the pass did not converge - the panel with the largest error estimate. Null when the
 * verdict of the pass stands.
 */
function nextSingularity(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number,
  pass: Pass,
  breakpoints: number[],
  singular: Singularity[],
): Singularity | null {
  if (pass.undefinedPoint !== undefined || pass.forced) return null;
  const fences = [...breakpoints, ...singular.map((s) => s.c)];
  const classify = (c: number) =>
    singular.some((s) => Math.abs(s.c - c) <= KNOWN_RADIUS * (b - a))
      ? null
      : classifyPoint(f, c, a, b, fences);
  const locate = (lo: number, hi: number) => {
    const w = hi - lo;
    const left = Math.max(a, lo - w);
    const right = Math.min(b, hi + w);
    const c = locatePeak(f, left, right);
    if (c - a <= SNAP_REL * (right - left)) return a;
    if (b - c <= SNAP_REL * (right - left)) return b;
    return c;
  };

  if (pass.stagnant) return classify(locate(pass.stagnant[0], pass.stagnant[1]));
  for (const c of signJumps(f, pass.panels)) {
    const s = classify(c);
    if (s) return s;
  }
  if (pass.totalError <= tol * Math.max(1, Math.abs(pass.total))) return null;
  let worst: Panel | undefined;
  for (const p of pass.panels) if (!worst || p.error > worst.error) worst = p;
  return worst ? classify(locate(worst.a, worst.b)) : null;
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
  const breakpoints = (opts.breakpoints ?? []).filter((p) => p > a && p < b);
  const singular: Singularity[] = [];

  let pass = runPass(f, a, b, tol, maxEvals, breakpoints, singular);
  for (let repair = 0; repair < MAX_REPAIRS; repair++) {
    const s = nextSingularity(f, a, b, tol, pass, breakpoints, singular);
    if (!s) break;
    if (s.divergent) {
      return { value: pass.total, error: pass.totalError, status: 'divergent', badPoint: s.c };
    }
    singular.push(s);
    pass = runPass(f, a, b, tol, maxEvals, breakpoints, singular);
  }

  const { total, divergentPoint, undefinedPoint } = pass;
  const error = pass.totalError + pass.tailError;
  if (divergentPoint !== undefined) {
    return { value: total, error, status: 'divergent', badPoint: divergentPoint };
  }
  if (undefinedPoint !== undefined) {
    return { value: total, error, status: 'undefined', badPoint: undefinedPoint };
  }
  if (error > Math.max(tol, INACCURATE_REL) * Math.max(1, Math.abs(total))) {
    return { value: total, error, status: 'inaccurate' };
  }
  return { value: total, error, status: 'ok' };
}
