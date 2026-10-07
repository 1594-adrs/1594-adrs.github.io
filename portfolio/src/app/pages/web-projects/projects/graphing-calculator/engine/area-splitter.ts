import type { IntersectionPoint } from './intersection-finder';
import { integrateAdaptive, type QuadratureStatus } from './quadrature';

export interface AreaRegion {
  a: number;
  b: number;
  /**
   * Area of the region. Finite for 'ok' / 'inaccurate'; +Infinity only when the region's area
   * genuinely diverges (status 'divergent'); NaN when the curves are undefined inside it
   * (status 'undefined'). Never a silently-zeroed or truncated number.
   */
  area: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
  /** Quadrature outcome for this region ('ok' unless the integral misbehaves). */
  status: QuadratureStatus;
  /** Location of the singularity / undefined point when status is 'divergent' or 'undefined'. */
  badPoint?: number;
}

const EPS = 1e-12;

/**
 * Splits [a, b] at the given intersections and integrates |top - bottom| over each region with
 * the adaptive Gauss-Kronrod quadrature (the single integration path of the app). Intersections
 * outside (a, b) are ignored and coincident ones merged, so a crossing beyond the interval can
 * never create a region that reaches outside [a, b]. `steps` is kept for API compatibility.
 */
export function computeAreaRegions(
  functions: Array<(x: number) => number>,
  intersections: IntersectionPoint[],
  a: number,
  b: number,
  _steps = 200,
): AreaRegion[] {
  if (!(b > a)) return [];
  const lo = a;
  const hi = b;
  const span = hi - lo;
  const inner = intersections
    .map((p) => p.x)
    .filter((x) => Number.isFinite(x) && x > lo + span * EPS && x < hi - span * EPS)
    .sort((p, q) => p - q);
  const boundaries = [lo];
  for (const x of inner) {
    if (x - boundaries[boundaries.length - 1] > Math.max(EPS, span * 1e-9)) boundaries.push(x);
  }
  boundaries.push(hi);

  const regions: AreaRegion[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const ra = boundaries[i];
    const rb = boundaries[i + 1];
    if (rb - ra < EPS) continue;

    const mid = (ra + rb) / 2;
    let topIdx = 0;
    let bottomIdx = 0;
    let topVal = -Infinity;
    let bottomVal = Infinity;

    for (let f = 0; f < functions.length; f++) {
      let val: number;
      try {
        val = functions[f](mid);
      } catch {
        continue;
      }
      if (!isFinite(val)) continue;
      if (val > topVal) {
        topVal = val;
        topIdx = f;
      }
      if (val < bottomVal) {
        bottomVal = val;
        bottomIdx = f;
      }
    }

    if (topVal === -Infinity || bottomVal === Infinity) continue;

    const top = functions[topIdx];
    const bottom = functions[bottomIdx];
    const gap = (x: number): number => {
      let t: number, bt: number;
      try {
        t = top(x);
      } catch {
        return NaN;
      }
      try {
        bt = bottom(x);
      } catch {
        return NaN;
      }
      return Math.abs(t - bt);
    };

    const result = integrateAdaptive(gap, ra, rb);
    const area =
      result.status === 'divergent' ? Infinity : result.status === 'undefined' ? NaN : result.value;

    regions.push({
      a: ra,
      b: rb,
      area,
      topFunctionIndex: topIdx,
      bottomFunctionIndex: bottomIdx,
      status: result.status,
      ...(result.badPoint !== undefined ? { badPoint: result.badPoint } : {}),
    });
  }

  return regions;
}
