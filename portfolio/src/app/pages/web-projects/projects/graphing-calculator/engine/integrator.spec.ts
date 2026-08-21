import { describe, it, expect } from 'vitest';
import { integrate, computeIntegralPoints } from './integrator';

describe('integrator', () => {
  it('should compute integral of x^2 from 0 to 1 ≈ 1/3', () => {
    const result = integrate((x) => x * x, 0, 1);
    expect(result).toBeCloseTo(1 / 3, 3);
  });

  it('should compute integral of sin(x) from 0 to π ≈ 2', () => {
    const result = integrate(Math.sin, 0, Math.PI);
    expect(result).toBeCloseTo(2, 3);
  });

  it('should compute integral of x^3 from -1 to 1 ≈ 0 (symmetric odd)', () => {
    const result = integrate((x) => x * x * x, -1, 1);
    expect(result).toBeCloseTo(0, 3);
  });

  it('should return 0 for equal bounds', () => {
    const result = integrate((x) => x * x, 3, 3);
    expect(result).toBe(0);
  });

  it('should handle negative interval (reversed bounds)', () => {
    const result = integrate((x) => x * x, 1, 0);
    expect(result).toBeCloseTo(-1 / 3, 3);
  });

  it('should compute integral of constant function', () => {
    const result = integrate(() => 5, 0, 10);
    expect(result).toBeCloseTo(50, 3);
  });

  it('should compute integral of e^x from 0 to 1 ≈ e - 1', () => {
    const result = integrate(Math.exp, 0, 1);
    expect(result).toBeCloseTo(Math.E - 1, 3);
  });

  it('should handle integrable singularity at boundary (1/sqrt(x) from 0 to 1 ≈ 2)', () => {
    const result = integrate((x) => x === 0 ? Infinity : 1 / Math.sqrt(x), 0, 1);
    expect(result).toBeGreaterThan(1.5);
    expect(result).toBeLessThan(2.5);
  });

  it('should handle function that throws at some interior points', () => {
    const f = (x: number) => {
      if (Math.abs(x) < 0.01) throw new Error('singularity');
      return 1;
    };
    const result = integrate(f, -1, 1);
    expect(result).toBeCloseTo(2, 0);
  });

  it('should detect divergent integral (1/x^2 from -1 to 1)', () => {
    const f = (x: number) => x === 0 ? Infinity : 1 / (x * x);
    const result = integrate(f, -1, 1);
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });

  it('should handle function returning NaN at isolated point', () => {
    const f = (x: number) => x === 0 ? NaN : x;
    const result = integrate(f, -1, 1);
    expect(result).toBeCloseTo(0, 3);
  });

  it('should compute integral of 1/x from 0.01 to 1 ≈ -ln(0.01)', () => {
    const result = integrate((x) => 1 / x, 0.01, 1);
    expect(result).toBeCloseTo(-Math.log(0.01), 2);
  });

  it('should compute integral of x from 0 to 10 = 50', () => {
    const result = integrate((x) => x, 0, 10);
    expect(result).toBeCloseTo(50, 2);
  });
});

describe('computeIntegralPoints', () => {
  it('should return correct number of points', () => {
    const points = computeIntegralPoints((x) => x, 0, 1, 100);
    expect(points.length).toBe(101);
  });

  it('should return points with correct x and y values', () => {
    const points = computeIntegralPoints((x) => x * x, 0, 2, 4);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[4]).toEqual({ x: 2, y: 4 });
  });
});
