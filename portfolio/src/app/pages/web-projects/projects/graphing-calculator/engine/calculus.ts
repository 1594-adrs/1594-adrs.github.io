import { integrate } from './integrator';
import type { RotationAxis } from '../models/calculator.models';

const RESULT_LIMIT = 1e15;

function clampResult(v: number): number {
  if (!isFinite(v)) return v;
  if (v > RESULT_LIMIT) return Number.POSITIVE_INFINITY;
  if (v < -RESULT_LIMIT) return Number.NEGATIVE_INFINITY;
  return v;
}

export function derivative(f: (x: number) => number, x: number, h = 0.0001): number {
  const fc = f(x);
  if (!isFinite(fc)) return 0;
  const fph = f(x + h);
  const fmh = f(x - h);
  if (!isFinite(fph) || !isFinite(fmh)) return 0;
  const d = (fph - fmh) / (2 * h);
  if (!isFinite(d)) return 0;
  return d;
}

export function solidVolume(
  f: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis = { type: 'x', value: 0 },
): number {
  if (axis.type === 'x') {
    return clampResult(Math.PI * integrate((x) => Math.pow(f(x) - axis.value, 2), a, b));
  }
  if (axis.type === 'y') {
    return clampResult(2 * Math.PI * integrate((x) => Math.abs(x - axis.value) * f(x), a, b));
  }
  return clampResult(Math.PI * integrate((x) => Math.pow(f(x) - axis.value, 2), a, b));
}

export function solidSurfaceArea(
  f: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis = { type: 'x', value: 0 },
): number {
  if (axis.type === 'x') {
    return clampResult(
      2 *
        Math.PI *
        integrate(
          (x) => Math.abs(f(x) - axis.value) * Math.sqrt(1 + Math.pow(derivative(f, x), 2)),
          a,
          b,
        ),
    );
  }
  if (axis.type === 'y') {
    return clampResult(
      2 *
        Math.PI *
        integrate(
          (x) => Math.abs(x - axis.value) * Math.sqrt(1 + Math.pow(derivative(f, x), 2)),
          a,
          b,
        ),
    );
  }
  return clampResult(
    2 *
      Math.PI *
      integrate(
        (x) => Math.abs(f(x) - axis.value) * Math.sqrt(1 + Math.pow(derivative(f, x), 2)),
        a,
        b,
      ),
  );
}

export function areaBetweenCurves(
  fUpper: (x: number) => number,
  fLower: (x: number) => number,
  a: number,
  b: number,
): number {
  return clampResult(integrate((x) => Math.abs(fUpper(x) - fLower(x)), a, b));
}

export interface AreaRegion {
  a: number;
  b: number;
  area: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
}

export function areaBetweenCurvesWithRegions(
  fUpper: (x: number) => number,
  fLower: (x: number) => number,
  a: number,
  b: number,
  steps = 200,
): { totalArea: number; regions: AreaRegion[] } {
  const h = (b - a) / steps;
  const crossPoints: number[] = [];
  const EPS = 1e-12;

  let prevDiff = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const diff = fUpper(x) - fLower(x);
    if (!isFinite(diff)) {
      prevDiff = NaN;
      continue;
    }
    if (Math.abs(diff) < EPS) {
      crossPoints.push(x);
      prevDiff = diff;
      continue;
    }
    if (isFinite(prevDiff) && Math.abs(prevDiff) >= EPS && prevDiff * diff < 0) {
      const t = prevDiff / (prevDiff - diff);
      crossPoints.push(a + (i - 1) * h + t * h);
    }
    prevDiff = diff;
  }

  const boundaries = [a, ...crossPoints, b];
  const regions: AreaRegion[] = [];
  let totalArea = 0;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const ra = boundaries[i];
    const rb = boundaries[i + 1];
    const mid = (ra + rb) / 2;
    const yU = fUpper(mid);
    const yL = fLower(mid);
    if (!isFinite(yU) || !isFinite(yL)) continue;

    const topIsUpper = yU >= yL;
    const area = clampResult(integrate((x) => Math.abs(fUpper(x) - fLower(x)), ra, rb));

    regions.push({
      a: ra,
      b: rb,
      area,
      topFunctionIndex: topIsUpper ? 0 : 1,
      bottomFunctionIndex: topIsUpper ? 1 : 0,
    });
    totalArea += area;
  }

  return { totalArea: clampResult(totalArea), regions };
}
