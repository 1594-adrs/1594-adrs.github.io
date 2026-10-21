import { integrateAdaptive } from './quadrature';

/**
 * Definite integral of `f` from `a` to `b`. Delegates to the adaptive
 * Gauss-Kronrod quadrature in `quadrature.ts`, mapped back onto this
 * function's older number-only convention: a divergent integral becomes a
 * signed Infinity (sign taken from the accumulated partial sum), and an
 * integrand that's outside its real domain over part of the interval becomes
 * NaN.
 */
export function integrate(f: (x: number) => number, a: number, b: number): number {
  const result = integrateAdaptive(f, a, b);
  if (result.status === 'divergent') {
    return result.value >= 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  if (result.status === 'undefined') {
    return NaN;
  }
  return result.value;
}
