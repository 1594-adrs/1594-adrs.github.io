import { describe, it, expect } from 'vitest';
import { findIntersections } from './intersection-finder';

const PI = Math.PI;

describe('findIntersections', () => {
  it('should find intersection of sin(x) and cos(x) on [0, 2π]', () => {
    const fns = [Math.sin, Math.cos];
    const result = findIntersections(fns, 0, 2 * PI);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const at45 = result.find((p) => Math.abs(p.x - PI / 4) < 0.02);
    expect(at45).toBeDefined();
    expect(at45!.y).toBeCloseTo(Math.sin(PI / 4), 2);
    expect(at45!.functionIndices).toEqual([0, 1]);
  });

  it('should return empty for parallel lines (no intersection)', () => {
    const fns = [(x: number) => x + 1, (x: number) => x + 2];
    const result = findIntersections(fns, 0, 10);
    expect(result).toEqual([]);
  });

  it('should deduplicate nearby points', () => {
    const fns = [Math.sin, Math.cos];
    const result = findIntersections(fns, 0, 2 * PI, 2000);
    const at45 = result.filter((p) => Math.abs(p.x - PI / 4) < 0.02);
    expect(at45.length).toBe(1);
  });

  it('should handle NaN gracefully when a function throws', () => {
    const throwing = (x: number) => {
      if (x > 5) throw new Error('boom');
      return x;
    };
    const fns = [throwing, (x: number) => 2 * x - 10];
    expect(() => findIntersections(fns, 0, 10)).not.toThrow();
  });

  it('should handle functions returning non-finite values', () => {
    const fns = [(x: number) => (x === 3 ? Infinity : x), (x: number) => x + 1];
    expect(() => findIntersections(fns, 0, 10)).not.toThrow();
  });

  it('should find all pairwise intersections for 3 functions', () => {
    const f1 = (x: number) => x;
    const f2 = (x: number) => 2 * x;
    const f3 = (x: number) => 3 * x - 2;
    const result = findIntersections([f1, f2, f3], 0, 5);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const f1f2 = result.find((p) => p.functionIndices.includes(0) && p.functionIndices.includes(1));
    expect(f1f2).toBeDefined();
    expect(f1f2!.x).toBeCloseTo(0, 4);
    const f1f3 = result.find((p) => p.functionIndices.includes(0) && p.functionIndices.includes(2));
    expect(f1f3).toBeDefined();
    expect(f1f3!.x).toBeCloseTo(1, 2);
  });

  it('should find intersection of x^2 and 4 on [0, 5]', () => {
    const fns = [(x: number) => x * x, (_x: number) => 4];
    const result = findIntersections(fns, 0, 5);
    expect(result.length).toBe(1);
    expect(result[0].x).toBeCloseTo(2, 1);
    expect(result[0].y).toBeCloseTo(4, 1);
  });

  it('should find domain-boundary intersection: x^2 vs sqrt(x) on non-aligned viewport', () => {
    const fns = [(x: number) => x * x, (x: number) => Math.sqrt(x)];
    const result = findIntersections(fns, -0.5, 2.5);
    const at0 = result.find((p) => Math.abs(p.x) < 0.02);
    const at1 = result.find((p) => Math.abs(p.x - 1) < 0.02);
    expect(at0).toBeDefined();
    expect(at0!.y).toBeCloseTo(0, 2);
    expect(at1).toBeDefined();
    expect(at1!.y).toBeCloseTo(1, 2);
  });

  it('should find domain-boundary intersection: sqrt(x) vs 0.5', () => {
    const fns = [(x: number) => Math.sqrt(x), (_x: number) => 0.5];
    const result = findIntersections(fns, -1, 3);
    const match = result.find((p) => Math.abs(p.x - 0.25) < 0.02);
    expect(match).toBeDefined();
    expect(match!.y).toBeCloseTo(0.5, 2);
  });

  it('should find domain-boundary intersection: ln(x) vs x-1', () => {
    const fns = [(x: number) => Math.log(x), (x: number) => x - 1];
    const result = findIntersections(fns, -2, 3);
    const at1 = result.find((p) => Math.abs(p.x - 1) < 0.02);
    expect(at1).toBeDefined();
    expect(at1!.y).toBeCloseTo(0, 2);
  });

  it('should return sorted by x', () => {
    const fns = [Math.sin, Math.cos];
    const result = findIntersections(fns, 0, 4 * PI);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x).toBeGreaterThanOrEqual(result[i - 1].x);
    }
  });
});
