import { findAxisCrossings } from '../canvas/utils';
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

/** Half-width (in x units) used to classify a candidate extremum by comparing
 *  it against its immediate neighbors. */
const CLASSIFY_DELTA = 1e-3;

function classifyExtremum(fn: (x: number) => number, x: number): CriticalPointKind | null {
  let y: number, yLeft: number, yRight: number;
  try {
    y = fn(x);
    yLeft = fn(x - CLASSIFY_DELTA);
    yRight = fn(x + CLASSIFY_DELTA);
  } catch {
    return null;
  }
  if (!isFinite(y) || !isFinite(yLeft) || !isFinite(yRight)) return null;
  if (y > yLeft && y > yRight) return 'max';
  if (y < yLeft && y < yRight) return 'min';
  return null;
}

/** Roots of an explicit curve y = f(x) on [a, b]. */
export function findRoots(fn: (x: number) => number, a: number, b: number): CriticalPoint[] {
  return findAxisCrossings(fn, a, b, 0).map((x) => ({ x, y: 0, kind: 'root' as const }));
}

/** Local extrema of an explicit curve y = f(x) on [a, b], found as sign changes
 *  of the numeric derivative and confirmed against neighboring values. */
export function findExtrema(fn: (x: number) => number, a: number, b: number): CriticalPoint[] {
  const df = (x: number) => derivative(fn, x);
  const candidates = findAxisCrossings(df, a, b, 0);
  const points: CriticalPoint[] = [];
  for (const x of candidates) {
    const kind = classifyExtremum(fn, x);
    if (!kind) continue;
    let y: number;
    try {
      y = fn(x);
    } catch {
      continue;
    }
    if (!isFinite(y)) continue;
    points.push({ x, y, kind });
  }
  return points;
}

/** Roots + local extrema of an explicit curve y = f(x) on [a, b], sorted by x. */
export function findCriticalPoints(
  fn: (x: number) => number,
  a: number,
  b: number,
): CriticalPoint[] {
  const merged = [...findRoots(fn, a, b), ...findExtrema(fn, a, b)];
  merged.sort((p, q) => p.x - q.x);
  return merged;
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
