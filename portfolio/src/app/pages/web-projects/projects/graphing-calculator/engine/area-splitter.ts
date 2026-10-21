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
const PROBES = [0.5, 0.49, 0.51, 0.25, 0.75];

function valuesAt(functions: Array<(x: number) => number>, x: number): number[] | null {
  const out: number[] = [];
  for (const f of functions) {
    let v: number;
    try {
      v = f(x);
    } catch {
      return null;
    }
    if (!isFinite(v)) return null;
    out.push(v);
  }
  return out;
}

/**
 * With 3+ curves, the region "bounded by" all of them (e, e^x, e^-x on [-1, 1]) is the band
 * between the k-th and (k+1)-th curve by height that closes at both a and b, not the envelope
 * between the highest and the lowest. Returns that k, or null (no unique closing band) to keep
 * the envelope.
 */
function closedBand(functions: Array<(x: number) => number>, a: number, b: number): number | null {
  if (functions.length < 3) return null;
  const at = [valuesAt(functions, a), valuesAt(functions, b)];
  let band: number | null = null;
  for (const vals of at) if (!vals) return null;
  for (let k = 0; k < functions.length - 1; k++) {
    const closes = at.every((vals) => {
      const s = [...vals!].sort((p, q) => p - q);
      const scale = Math.max(1, Math.abs(s[k]), Math.abs(s[k + 1]));
      return s[k + 1] - s[k] <= 1e-6 * scale;
    });
    if (!closes) continue;
    if (band !== null) return null;
    band = k;
  }
  return band;
}

/**
 * Splits [a, b] at the given intersections and integrates |top - bottom| over each region with
 * the adaptive Gauss-Kronrod quadrature (the single integration path of the app). Intersections
 * outside (a, b) are ignored and coincident ones merged, so a crossing beyond the interval can
 * never create a region that reaches outside [a, b]. A region where no probe point has every
 * curve defined is reported as 'undefined' (area NaN), never as a zero-height region.
 */
export function computeAreaRegions(
  functions: Array<(x: number) => number>,
  intersections: IntersectionPoint[],
  a: number,
  b: number,
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
  const band = closedBand(functions, lo, hi);

  for (let i = 0; i < boundaries.length - 1; i++) {
    const ra = boundaries[i];
    const rb = boundaries[i + 1];
    if (rb - ra < EPS) continue;

    // probe off-centre too: a removable hole (sin(x)/x at 0) must not hide a curve
    const vals = PROBES.reduce<number[] | null>(
      (found, t) => found ?? valuesAt(functions, ra + t * (rb - ra)),
      null,
    );
    if (!vals) {
      regions.push({
        a: ra,
        b: rb,
        area: NaN,
        topFunctionIndex: 0,
        bottomFunctionIndex: 0,
        status: 'undefined',
        badPoint: (ra + rb) / 2,
      });
      continue;
    }

    let topIdx = vals.indexOf(Math.max(...vals));
    let bottomIdx = vals.indexOf(Math.min(...vals));
    if (band !== null) {
      const order = vals.map((_, i) => i).sort((p, q) => vals[p] - vals[q]);
      bottomIdx = order[band];
      topIdx = order[band + 1];
    }

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
