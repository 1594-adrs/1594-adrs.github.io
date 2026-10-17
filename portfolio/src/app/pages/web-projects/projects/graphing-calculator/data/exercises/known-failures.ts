/**
 * Exercises expected to fail, by id, with the status they fail with. The dataset spec is a
 * ratchet: an entry whose exercise now passes (or fails differently) fails the spec until removed.
 */
export const KNOWN_FAILURES: Record<string, 'mismatch' | 'parse-error'> = {
  // Extrema: below double precision. The expanded degree-11 polynomial is flat at x=3
  // (f(3±0.1) - f(3) ≈ 3e-7 vs cancellation noise ≈ 3e-8 on f ≈ 36094).
  'thomas12-4A-4': 'mismatch',
  // Limit 'unknown': ln(ln x)/ln x → 0 like 1/s·ln(1/s) in s = 1/ln x, too slow for x = 1.3·2^k.
  'thomas12-7.8-6g': 'mismatch',
  'thomas12-7.8-10g': 'mismatch',
  'thomas12-7P-111d': 'mismatch',
  // ODE: the start point is singular (f undefined at x0), so Dormand–Prince cannot take a step.
  'thomas12-4A-28a': 'mismatch',
  // ODE: y' = -x/y with y = sqrt(4-x²) reaches y = 0 exactly at the target x = 2, where f blows up.
  'thomas12-9.1-40d': 'mismatch',
  // Sequence/series: factorials and powers overflow (n! past n = 170, Inf/Inf) before the terms
  // settle; needs a log-domain term evaluator.
  'openstax2-5.1-52': 'mismatch',
  'openstax2-5.4-199': 'mismatch',
  'openstax2-5.6-355': 'mismatch',
  'thomas12-10.1-65': 'mismatch',
  'thomas12-10.2-61': 'mismatch',
  'thomas12-10.4-36': 'mismatch',
  'thomas12-10.4-44': 'mismatch',
  // Sequence: high log powers over n (and nth roots of them) turn over far beyond the sampled range.
  'thomas12-10.1-85': 'mismatch',
  'openstax2-5.6-351': 'mismatch',
  'thomas12-10.1-61': 'mismatch',
  'thomas12-10.1-62': 'mismatch',
  'thomas12-10.1-104b': 'mismatch',
  'thomas12-10P-13': 'mismatch',
  // Series: tails decay too slowly for 16384 partial sums to settle (no acceleration yet).
  'openstax2-5.2-107': 'mismatch',
  'openstax2-5.3-164': 'mismatch',
  'openstax2-5.3-166': 'mismatch',
  'thomas12-10.2-47': 'mismatch',
  // sin(nπ·k) with fl(π): the "zero" terms are ~1e-16·n, so parity sides never agree.
  'openstax2-5.5-278': 'mismatch',
  'thomas12-10P-6': 'mismatch',
  // Inherent: catastrophic cancellation in the term (10.6-33); a flat staircase sequence (10.1-120).
  'thomas12-10.6-33': 'mismatch',
  'thomas12-10.1-120': 'mismatch',
  // Riemann: the record's R100 of e^(2x) on [-1,1] is 3.670; the exact geometric sum is 3.6998.
  'openstax2-1.1-33R': 'mismatch',
  // Centroid of a half-ring: a region with a hole that the max/min envelope cannot express (NaN).
  'openstax2-2.6-289': 'mismatch',
  // Polar area: the book excludes the inner loop; ½∫r² over the range counts it (no "outside loop" op).
  'openstax2-7.4-197': 'mismatch',
  'openstax2-7.4-208': 'mismatch',
  // Derivative of cbrt(x)²·sin(x) ~ x^(5/3) at 0: the symbolic form is 0·∞, so the central difference's
  // O(h^(2/3)) error (4e-5) exceeds the tolerance at a non-smooth point.
  'thomas12-3A-22b': 'mismatch',
};
