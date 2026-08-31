import { describe, it, expect } from 'vitest';
import { tryEval, findAxisCrossings } from './utils';

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

describe('findAxisCrossings', () => {
  it('sin(x) with y=0: finds 0 and π', () => {
    const c = findAxisCrossings(Math.sin, -0.5, 4, 0);
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c[0]).toBeCloseTo(0, 3);
    expect(c[1]).toBeCloseTo(Math.PI, 3);
  });

  it('x^2 with y=1: finds -1 and 1', () => {
    const c = findAxisCrossings((x) => x * x, -2, 2, 1);
    expect(c.length).toBe(2);
    expect(c[0]).toBeCloseTo(-1, 3);
    expect(c[1]).toBeCloseTo(1, 3);
  });

  it('x^2+1 with y=0: no crossings (function above axis)', () => {
    const c = findAxisCrossings((x) => x * x + 1, -10, 10, 0);
    expect(c.length).toBe(0);
  });

  it('constant y=5 with y=0: no crossings', () => {
    const c = findAxisCrossings(() => 5, -10, 10, 0);
    expect(c.length).toBe(0);
  });

  it('cos(x) with y=0: finds π/2 and 3π/2 in range [0, 2π]', () => {
    const c = findAxisCrossings(Math.cos, 0, 2 * Math.PI, 0);
    expect(c.length).toBe(2);
    expect(c[0]).toBeCloseTo(Math.PI / 2, 3);
    expect(c[1]).toBeCloseTo((3 * Math.PI) / 2, 3);
  });

  it('sin(x) with y=0.5: finds crossings', () => {
    const c = findAxisCrossings(Math.sin, -0.5, 4, 0.5);
    expect(c.length).toBeGreaterThanOrEqual(2);
  });
});
