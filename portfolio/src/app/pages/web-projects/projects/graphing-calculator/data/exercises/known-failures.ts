/**
 * Exercises expected to fail, by id, with the status they fail with. The dataset spec is a
 * ratchet: an entry whose exercise now passes (or fails differently) fails the spec until removed.
 */
export const KNOWN_FAILURES: Record<string, 'mismatch' | 'parse-error'> = {
  // Extrema: below double precision. The expanded degree-11 polynomial is flat at x=3
  // (f(3±0.1) - f(3) ≈ 3e-7 vs cancellation noise ≈ 3e-8 on f ≈ 36094).
  'thomas12-4A-4': 'mismatch',
};
