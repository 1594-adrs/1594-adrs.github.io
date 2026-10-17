/**
 * Centroid of the region between curves (the region the area tool measures: the same
 * intersections, the same top/bottom envelope rule from computeAreaRegions). Pure math: no
 * DOM/Angular.
 *
 * With curves u = fᵢ(s) over s ∈ [a, b] and top T, bottom B on each region:
 *   A = ∫ (T − B) ds,  s̄ = ∫ s (T − B) ds / A,  ū = ∫ (T² − B²)/2 ds / A.
 * For curves y = f(x) (variable 'x') that is (x̄, ȳ) = (s̄, ū); for x = g(y) it is (ū, s̄).
 * A single curve bounds the region with the axis (u = 0).
 */
import { computeAreaRegions } from './area-splitter';
import { findIntersections } from './intersection-finder';
import { integrateAdaptive, type QuadratureStatus } from './quadrature';

export interface CentroidResult {
  x: number;
  y: number;
  area: number;
  /** Worst quadrature status; x, y are NaN unless 'ok' / 'inaccurate'. */
  status: QuadratureStatus;
  badPoint?: number;
}

const RANK: Record<QuadratureStatus, number> = { ok: 0, inaccurate: 1, divergent: 2, undefined: 3 };

export function computeCentroid(
  functions: Array<(s: number) => number>,
  a: number,
  b: number,
  variable: 'x' | 'y' = 'x',
): CentroidResult {
  const fns = functions.length === 1 ? [functions[0], () => 0] : functions;
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const regions = computeAreaRegions(fns, findIntersections(fns, lo, hi), lo, hi);

  let area = 0;
  let ms = 0;
  let mu = 0;
  let status: QuadratureStatus = 'ok';
  let badPoint: number | undefined;
  const note = (st: QuadratureStatus, bp?: number) => {
    if (RANK[st] > RANK[status]) [status, badPoint] = [st, bp];
  };

  for (const r of regions) {
    note(r.status, r.badPoint);
    const top = fns[r.topFunctionIndex];
    const bottom = fns[r.bottomFunctionIndex];
    const s1 = integrateAdaptive((s) => s * (top(s) - bottom(s)), r.a, r.b);
    const s2 = integrateAdaptive((s) => (top(s) ** 2 - bottom(s) ** 2) / 2, r.a, r.b);
    note(s1.status, s1.badPoint);
    note(s2.status, s2.badPoint);
    area += r.area;
    ms += s1.value;
    mu += s2.value;
  }

  if (RANK[status] >= RANK.divergent || !(area > 0)) {
    return { x: NaN, y: NaN, area, status: status === 'ok' ? 'undefined' : status, badPoint };
  }
  const [sBar, uBar] = [ms / area, mu / area];
  return variable === 'x' ? { x: sBar, y: uBar, area, status } : { x: uBar, y: sBar, area, status };
}
