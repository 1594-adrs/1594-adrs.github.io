import type { IntersectionPoint } from './intersection-finder';
import type { SolidRegion } from './calculus';
import type { OverlapMode } from '../models/calculator.models';

interface AreaRegion {
  a: number;
  b: number;
  area: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
}

const EPS = 1e-12;

function hasCrossing(
  fn: (x: number) => number,
  refFn: (x: number) => number,
  a: number,
  b: number,
  steps = 50,
): boolean {
  const h = (b - a) / steps;
  let prevDiff = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const yFn = fn(x);
    const yRef = refFn(x);
    if (!isFinite(yFn) || !isFinite(yRef)) {
      prevDiff = NaN;
      continue;
    }
    const diff = yFn - yRef;
    if (Math.abs(diff) < EPS) continue;
    if (isFinite(prevDiff) && prevDiff * diff < 0) return true;
    prevDiff = diff;
  }
  return false;
}

function isAllOverlapClean(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  a: number,
  b: number,
): boolean {
  const topFn = functions[topIdx];
  const botFn = functions[bottomIdx];

  for (let k = 0; k < functions.length; k++) {
    if (k === topIdx || k === bottomIdx) continue;
    const fn = functions[k];

    if (hasCrossing(fn, topFn, a, b)) return false;
    if (hasCrossing(fn, botFn, a, b)) return false;

    const mid = (a + b) / 2;
    const yFn = fn(mid);
    const yTop = topFn(mid);
    const yBot = botFn(mid);
    if (isFinite(yFn) && isFinite(yTop) && isFinite(yBot)) {
      if (yFn > yTop + EPS || yFn < yBot - EPS) return false;
    }
  }

  return true;
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

export function computeRevolutionRegions(
  functions: Array<(x: number) => number>,
  intersections: IntersectionPoint[],
  a: number,
  b: number,
  overlapMode: OverlapMode = 'pairwise',
): SolidRegion[] {
  const boundaries = [a, ...intersections.map((p) => p.x), b];
  const regions: SolidRegion[] = [];

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
    if (topIdx === bottomIdx) continue;

    if (overlapMode === 'all') {
      if (!isAllOverlapClean(functions, topIdx, bottomIdx, ra, rb)) continue;
    }

    regions.push({ a: ra, b: rb, topFunctionIndex: topIdx, bottomFunctionIndex: bottomIdx });
  }

  return regions;
}
