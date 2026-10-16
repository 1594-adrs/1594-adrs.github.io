import { findAxisCrossings, goldenSectionMinimize, safeEval } from './numeric-utils';
import { derivative } from './calculus';
import { findIntersections } from './intersection-finder';

export type CriticalPointKind = 'root' | 'max' | 'min';

export interface CriticalPoint {
  x: number;
  y: number;
  kind: CriticalPointKind;
}

export interface NamedCurve {
  label: string;
  fn: (x: number) => number;
}

export interface PointOfInterest {
  x: number;
  y: number;
  label: string;
}

/** Samples used to bracket critical points (findAxisCrossings' default spacing). */
const STEPS = 500;

/** A candidate extremum must stand out from its neighbours by more than this (relative to
 *  max(1, |y|)); otherwise it is floating-point noise on a flat curve (e.g. 1e-14*sin(1000x)). */
const NOISE_REL = 1e-12;

/** Width of the "plateau" around a refined extremum, relative to |f| there (no floor): values
 *  within it are rounding noise of the extreme value. */
const PLATEAU_REL = 1e-13;

/** Upper bound of critical points returned per curve; denser results are thinned evenly. */
export const MAX_CRITICAL_POINTS = 100;

function thin<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(items[Math.floor((i * items.length) / cap)]);
  return out;
}

/**
 * Kind of the candidate `c` from f at points `d` away on each side (within [loLim, hiLim]), with `d`
 * doubling from `h` while a side is within noise of f(c): a flat extremum (x^10 at 0) does not stand
 * out one sample away. Returns the bracket where it does, or null (inflection, noise, undefined).
 */
function classifyExtremum(
  fn: (x: number) => number,
  c: number,
  loLim: number,
  hiLim: number,
  h: number,
  span: number,
): { kind: CriticalPointKind; lo: number; hi: number } | null {
  const yc = safeEval(fn, c);
  if (yc === null) return null;
  const tol = NOISE_REL * Math.max(1, Math.abs(yc));
  const side = (x: number): number => {
    const y = safeEval(fn, x);
    return y === null ? NaN : Math.abs(yc - y) > tol ? Math.sign(yc - y) : 0;
  };
  for (let d = h; d <= span; d *= 2) {
    const lo = Math.max(c - d, loLim);
    const hi = Math.min(c + d, hiLim);
    const sl = side(lo);
    const sr = side(hi);
    if (Number.isNaN(sl) || Number.isNaN(sr) || sl * sr < 0) return null;
    if (sl !== 0 && sl === sr) return { kind: sl > 0 ? 'max' : 'min', lo, hi };
    if (lo === loLim && hi === hiLim) return null;
  }
  return null;
}

/**
 * Locates the minimum of `s*f` on [lo, hi]: golden-section search, then the midpoint of the plateau
 * where s*f stays within rounding noise of that minimum. Golden-section alone stops anywhere on the
 * plateau of a flat extremum (x^5 - 5x^4 at 0 is flat to ~3e-4 in floating point); the plateau's
 * midpoint is the extremum to second order, and a cusp's plateau is tiny.
 */
function refineExtremum(fn: (x: number) => number, lo: number, hi: number, s: 1 | -1): number {
  const obj = (x: number): number => {
    const y = safeEval(fn, x);
    return y === null ? Infinity : s * y;
  };
  const xm = goldenSectionMinimize(obj, lo, hi);
  const om = obj(xm);
  const limit = om + PLATEAU_REL * Math.abs(om);
  const edge = (out: number): number => {
    let inside = xm;
    for (let k = 0; k < 64; k++) {
      const mid = inside + (out - inside) / 2;
      if (mid === inside || mid === out) break;
      if (obj(mid) <= limit) inside = mid;
      else out = mid;
    }
    return inside;
  };
  return (edge(lo) + edge(hi)) / 2;
}

/** Roots of an explicit curve y = f(x) on [a, b]. */
export function findRoots(fn: (x: number) => number, a: number, b: number): CriticalPoint[] {
  return findAxisCrossings(fn, a, b, 0).map((x) => ({ x, y: 0, kind: 'root' as const }));
}

/** Local extrema of an explicit curve y = f(x) on [a, b]: zeros of the numeric derivative,
 *  confirmed and located on f itself (flat extrema, cusps and close pairs included). */
export function findExtrema(fn: (x: number) => number, a: number, b: number): CriticalPoint[] {
  const span = Math.abs(b - a);
  const h = span / STEPS;
  if (!(h > 0)) return [];
  const [xMin, xMax] = a < b ? [a, b] : [b, a];
  // f' divided by max(1, 1e-4|f|) (positive: same zeros and signs) so its rounding noise, ~1e-12|f|,
  // stays under the root residual tolerance on large-valued curves.
  const df = (x: number) => derivative(fn, x) / Math.max(1, 1e-4 * Math.abs(fn(x)));
  const candidates = findAxisCrossings(df, xMin, xMax, 0, STEPS);
  const points: CriticalPoint[] = [];
  candidates.forEach((c, i) => {
    // Brackets stop halfway to the neighbouring candidates, so critical points closer than h
    // (1.2585 and 1.2599) are refined separately.
    const loLim = i > 0 ? (candidates[i - 1] + c) / 2 : xMin - h;
    const hiLim = i + 1 < candidates.length ? (c + candidates[i + 1]) / 2 : xMax + h;
    const cls = classifyExtremum(fn, c, loLim, hiLim, h, span);
    if (!cls) return;
    const xr = refineExtremum(fn, cls.lo, cls.hi, cls.kind === 'max' ? -1 : 1);
    const x = Math.min(xMax, Math.max(xMin, xr));
    const y = safeEval(fn, x);
    if (y === null) return;
    // A pole is no extremum: f collapses within a hair of the refined point ((x - 6/x)^8 near 0,
    // where the central difference is symmetric and vanishes), while a peak or cusp is continuous.
    const delta = 1e-9 * Math.max(1, Math.abs(x));
    const jumps = (t: number) =>
      !(Math.abs((safeEval(fn, t) ?? Infinity) - y) <= 0.5 * Math.max(1, Math.abs(y)));
    if (jumps(x - delta) || jumps(x + delta)) return;
    points.push({ x, y, kind: cls.kind });
  });
  return points;
}

/** Roots + local extrema of an explicit curve y = f(x) on [a, b], sorted by x. A curve that is
 *  identically zero (or constant) has none, flat stretches count once, and the result is capped
 *  at MAX_CRITICAL_POINTS (thinned evenly) so a rapidly oscillating curve cannot flood the UI. */
export function findCriticalPoints(
  fn: (x: number) => number,
  a: number,
  b: number,
): CriticalPoint[] {
  const merged = [...findRoots(fn, a, b), ...findExtrema(fn, a, b)];
  merged.sort((p, q) => p.x - q.x);
  return thin(merged, MAX_CRITICAL_POINTS);
}

/** Points of interest for a set of named explicit curves: each curve's roots and
 *  local extrema, plus pairwise intersections between the curves. */
export function computePointsOfInterest(
  curves: NamedCurve[],
  a: number,
  b: number,
): PointOfInterest[] {
  const points: PointOfInterest[] = [];

  for (const curve of curves) {
    for (const cp of findCriticalPoints(curve.fn, a, b)) {
      points.push({ x: cp.x, y: cp.y, label: `${cp.kind} of ${curve.label}` });
    }
  }

  if (curves.length >= 2) {
    const evalFns = curves.map((c) => c.fn);
    for (const pt of findIntersections(evalFns, a, b)) {
      const names = pt.functionIndices.map((i) => curves[i].label).join(' & ');
      points.push({ x: pt.x, y: pt.y, label: `${names} intersection` });
    }
  }

  return points;
}
