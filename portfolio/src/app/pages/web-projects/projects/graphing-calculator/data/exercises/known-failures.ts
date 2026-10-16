/**
 * Exercises expected to fail, by id, with the status they fail with. The dataset spec is a
 * ratchet: an entry whose exercise now passes (or fails differently) fails the spec until removed.
 */
export const KNOWN_FAILURES: Record<string, 'mismatch' | 'parse-error'> = {
  // Roots: zero at a domain endpoint (no sign change) is not found.
  'openstax1-1.1-15': 'mismatch',
  'openstax1-1.1-58': 'mismatch',
  // Roots: two close or touching zeros merge into one.
  'synthetic-roots-4': 'mismatch',
  'thomas12-2.3-55': 'mismatch',
  // Roots: high-multiplicity zero located imprecisely (flat sign change).
  'openstax1-4.4-165': 'mismatch',
  // Extrema: flat (high-multiplicity) extremum missed.
  'openstax1-3.6-243': 'mismatch',
  'openstax1-4.3-132': 'mismatch',
  'openstax1-4.5-227': 'mismatch',
  'thomas12-4.4-22': 'mismatch',
  'thomas12-4.4-44': 'mismatch',
  'thomas12-4.4-113a': 'mismatch',
  'thomas12-4.5-64b': 'mismatch',
  'thomas12-4A-4': 'mismatch',
  // Extrema: two close critical points merge into one.
  'thomas12-4P-10b': 'mismatch',
  // Extrema: cusp extremum located imprecisely (root(3, x^2)).
  'thomas12-4.1-84': 'mismatch',
  'thomas12-4.4-33': 'mismatch',
  // Extrema: missed on a large interval (sampling too coarse for the scale).
  'thomas12-1.1-72b': 'mismatch',
  // Quadrature: integrable endpoint singularity x^-p with p near 1 declared divergent.
  'synthetic-improper-8': 'mismatch',
  'thomas12-8.7-8': 'mismatch',
  // Quadrature: interior integrable singularity loses accuracy (5.99936 vs 6).
  'thomas12-8.7-5': 'mismatch',
  'thomas12-8P-55': 'mismatch',
  // Area semantics: region bounded by 3 curves vs the calculator's envelope between highest and lowest.
  'openstax2-2.1-12': 'mismatch',
  'openstax2-2.1-15': 'mismatch',
  // Area: book counts one lobe, calculator both symmetric lobes (to confirm against the source).
  'openstax2-2.1-14': 'mismatch',
};
