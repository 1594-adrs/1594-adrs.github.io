import { describe, it, expect } from 'vitest';
import {
  findRoots,
  findExtrema,
  findCriticalPoints,
  computePointsOfInterest,
} from './critical-points';

describe('critical-points', () => {
  describe('x^2 - 1', () => {
    const f = (x: number) => x * x - 1;

    it('finds roots at -1 and 1', () => {
      const roots = findRoots(f, -5, 5).map((r) => r.x);
      expect(roots.length).toBe(2);
      expect(roots.some((x) => Math.abs(x + 1) < 1e-3)).toBe(true);
      expect(roots.some((x) => Math.abs(x - 1) < 1e-3)).toBe(true);
    });

    it('finds a minimum at (0, -1)', () => {
      const extrema = findExtrema(f, -5, 5);
      expect(extrema.length).toBe(1);
      expect(extrema[0].kind).toBe('min');
      expect(extrema[0].x).toBeCloseTo(0, 3);
      expect(extrema[0].y).toBeCloseTo(-1, 3);
    });

    it('combines roots and extrema sorted by x', () => {
      const all = findCriticalPoints(f, -5, 5);
      expect(all.map((p) => p.kind)).toEqual(['root', 'min', 'root']);
    });
  });

  describe('sin(x) on [0, 2*pi]', () => {
    const f = Math.sin;
    const a = 0;
    const b = 2 * Math.PI;

    it('finds roots at 0, pi, 2*pi', () => {
      const roots = findRoots(f, a, b).map((r) => r.x);
      expect(roots.length).toBe(3);
      expect(roots[0]).toBeCloseTo(0, 3);
      expect(roots[1]).toBeCloseTo(Math.PI, 3);
      expect(roots[2]).toBeCloseTo(2 * Math.PI, 3);
    });

    it('finds a max at pi/2 and a min at 3*pi/2', () => {
      const extrema = findExtrema(f, a, b);
      expect(extrema.length).toBe(2);
      const max = extrema.find((p) => p.kind === 'max');
      const min = extrema.find((p) => p.kind === 'min');
      expect(max?.x).toBeCloseTo(Math.PI / 2, 3);
      expect(max?.y).toBeCloseTo(1, 3);
      expect(min?.x).toBeCloseTo((3 * Math.PI) / 2, 3);
      expect(min?.y).toBeCloseTo(-1, 3);
    });
  });

  describe('x^3 - 3x', () => {
    const f = (x: number) => x * x * x - 3 * x;

    it('finds a max at (-1, 2) and a min at (1, -2)', () => {
      const extrema = findExtrema(f, -5, 5);
      expect(extrema.length).toBe(2);
      const max = extrema.find((p) => p.kind === 'max');
      const min = extrema.find((p) => p.kind === 'min');
      expect(max?.x).toBeCloseTo(-1, 3);
      expect(max?.y).toBeCloseTo(2, 3);
      expect(min?.x).toBeCloseTo(1, 3);
      expect(min?.y).toBeCloseTo(-2, 3);
    });
  });

  describe('computePointsOfInterest', () => {
    it('includes per-curve critical points and cross-curve intersections', () => {
      const curves = [
        { label: 'f1', fn: (x: number) => x * x - 1 },
        { label: 'f2', fn: (x: number) => 0 },
      ];
      const points = computePointsOfInterest(curves, -5, 5);
      expect(points.some((p) => p.label.includes('min of f1'))).toBe(true);
      expect(points.some((p) => p.label.includes('intersection'))).toBe(true);
    });

    it('returns only per-curve points for a single curve', () => {
      const curves = [{ label: 'f1', fn: (x: number) => x * x - 1 }];
      const points = computePointsOfInterest(curves, -5, 5);
      expect(points.every((p) => !p.label.includes('intersection'))).toBe(true);
      expect(points.length).toBe(3);
    });
  });
});
