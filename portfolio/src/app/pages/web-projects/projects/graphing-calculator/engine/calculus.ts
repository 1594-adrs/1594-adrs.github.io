import { integrate } from './integrator';

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

export function areaSingle(f: (x: number) => number, a: number, b: number): number {
  return clampResult(integrate((x) => Math.abs(f(x)), a, b));
}
