import type { IntersectionPoint } from './intersection-finder';

export interface AreaRegion {
  a: number;
  b: number;
  area: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
}

export function computeAreaRegions(
  functions: Array<(x: number) => number>,
  intersections: IntersectionPoint[],
  a: number,
  b: number,
  steps = 200,
): AreaRegion[] {
  const boundaries = [a, ...intersections.map((p) => p.x), b];
  const regions: AreaRegion[] = [];
  const EPS = 1e-12;

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

    let area = 0;
    const h = (rb - ra) / steps;
    for (let k = 0; k < steps; k++) {
      const x = ra + k * h;
      const x2 = x + h;
      let t1: number, b1: number, t2: number, b2: number;
      try {
        t1 = functions[topIdx](x);
      } catch {
        t1 = NaN;
      }
      try {
        b1 = functions[bottomIdx](x);
      } catch {
        b1 = NaN;
      }
      try {
        t2 = functions[topIdx](x2);
      } catch {
        t2 = NaN;
      }
      try {
        b2 = functions[bottomIdx](x2);
      } catch {
        b2 = NaN;
      }

      const y1 = isNaN(t1) || isNaN(b1) ? 0 : t1 - b1;
      const y2 = isNaN(t2) || isNaN(b2) ? 0 : t2 - b2;
      area += ((Math.abs(y1) + Math.abs(y2)) * h) / 2;
    }

    regions.push({ a: ra, b: rb, area, topFunctionIndex: topIdx, bottomFunctionIndex: bottomIdx });
  }

  return regions;
}
