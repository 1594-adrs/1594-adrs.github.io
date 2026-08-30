import { describe, it, expect } from 'vitest';
import { tryEval } from './utils';

const CLAMP = 1e8;

describe('tryEval', () => {
  it('should return the normal value', () => {
    const fn = (x: number) => x * 2;
    expect(tryEval(fn, 5)).toBe(10);
  });

  it('should return NaN for NaN result', () => {
    const fn = (_x: number) => NaN;
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should return NaN for Infinity result', () => {
    const fn = (_x: number) => Infinity;
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should return NaN for negative Infinity result', () => {
    const fn = (_x: number) => -Infinity;
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should return NaN when function throws', () => {
    const fn = (_x: number) => {
      throw new Error('boom');
    };
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should clamp large positive values to CLAMP', () => {
    const fn = (_x: number) => CLAMP + 1000;
    expect(tryEval(fn, 1)).toBe(CLAMP);
  });

  it('should clamp large negative values to -CLAMP', () => {
    const fn = (_x: number) => -(CLAMP + 1000);
    expect(tryEval(fn, 1)).toBe(-CLAMP);
  });

  it('should return values within range unchanged', () => {
    const fn = (_x: number) => 42;
    expect(tryEval(fn, 0)).toBe(42);
  });
});
