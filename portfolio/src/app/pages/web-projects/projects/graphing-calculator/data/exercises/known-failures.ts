/**
 * Exercises expected to fail, by id, with the status they fail with. The dataset spec is a
 * ratchet: an entry whose exercise now passes (or fails differently) fails the spec until removed.
 */
export const KNOWN_FAILURES: Record<string, 'mismatch' | 'parse-error'> = {};
