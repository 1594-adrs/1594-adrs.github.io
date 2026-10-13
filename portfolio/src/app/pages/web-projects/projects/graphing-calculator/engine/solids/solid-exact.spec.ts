import { describe, it, expect } from 'vitest';
import { recognizeExact } from './solid-exact';

describe('recognizeExact', () => {
  it.each([
    [Math.PI / 3, 'π/3'],
    [(8 * Math.PI) / 3, '8π/3'],
    [8 * Math.PI, '8π'],
    [(4 * Math.PI) / 3, '4π/3'],
    [(2 * Math.PI) / 15, '2π/15'],
    [(7 * Math.PI) / 15, '7π/15'],
    [Math.PI / 5, 'π/5'],
    [Math.PI / 2, 'π/2'],
    [(5 * Math.PI) / 6, '5π/6'],
    [2 * Math.PI, '2π'],
    [(6 * Math.PI) / 5, '6π/5'],
    [16 / 3, '16/3'],
    [(2 * Math.PI) / 3, '2π/3'],
    [(4 * Math.sqrt(3)) / 3, '4√3/3'],
    [1 / 60, '1/60'],
    [16, '16'],
    [4 * Math.PI, '4π'],
    [Math.SQRT2, '√2'],
    [Math.PI * Math.SQRT2, 'π√2'],
    [-Math.PI / 3, '-π/3'],
  ])('recognizes %f as %s', (value, expected) => {
    expect(recognizeExact(value)).toBe(expected);
  });

  it('returns null for an arbitrary irrational-looking decimal', () => {
    expect(recognizeExact(0.123456789)).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(recognizeExact(NaN)).toBeNull();
    expect(recognizeExact(Infinity)).toBeNull();
  });

  it('prefers the smallest denominator, then the fewest radicals', () => {
    // 1/2 should be recognized as the plain rational, not e.g. an
    // over-fitted radical form at a larger denominator.
    expect(recognizeExact(0.5)).toBe('1/2');
  });
});

describe('recognizeExact false positives (H13)', () => {
  it('rejects large arbitrary values instead of fitting a far-fetched closed form', () => {
    expect(recognizeExact(123456.789)).toBeNull();
    expect(recognizeExact(1e6 + 0.123)).toBeNull();
  });

  it('keeps the false-positive rate negligible on random values in [1e3, 1e6]', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let hits = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const v = 1e3 * Math.pow(1e3, rand());
      if (recognizeExact(v) !== null) hits++;
    }
    // Was 3.7% on [1e3, 1e4] and 94% on [1e5, 1e6].
    expect(hits / n).toBeLessThan(0.005);
  });

  it('still recognises genuine moderate-size forms', () => {
    expect(recognizeExact(Math.PI * 16)).toBe('16π');
    expect(recognizeExact(900)).toBe('900');
    expect(recognizeExact((256 * Math.PI) / 15)).toBe('256π/15');
  });
});
