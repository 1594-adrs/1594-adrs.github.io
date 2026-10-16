import { describe, it, expect } from 'vitest';
import {
  findRoots,
  findExtrema,
  findCriticalPoints,
  computePointsOfInterest,
  MAX_CRITICAL_POINTS,
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

describe('critical-points wave-1 (H25)', () => {
  it('f(x) = 0 on [-5, 5] has no roots (was 231) and no extrema', () => {
    expect(findRoots(() => 0, -5, 5)).toEqual([]);
    expect(findExtrema(() => 0, -5, 5)).toEqual([]);
    expect(findCriticalPoints(() => 0, -5, 5)).toEqual([]);
  });

  it('a nonzero constant has no critical points', () => {
    expect(findCriticalPoints(() => 3, -5, 5)).toEqual([]);
  });

  it('a flat stretch counts once: max(0, x) has a single root-run entry', () => {
    const pts = findCriticalPoints((x) => Math.max(0, x), -5, 5);
    expect(pts.filter((p) => p.kind === 'root').length).toBe(1);
    expect(pts.filter((p) => p.kind !== 'root').length).toBe(0);
  });

  it('floating-point noise on a flat curve produces no extrema (was 162)', () => {
    expect(findExtrema((x) => 1e-14 * Math.sin(1000 * x), -5, 5)).toEqual([]);
  });

  it('caps a rapidly oscillating curve at MAX_CRITICAL_POINTS, still sorted by x', () => {
    const pts = findCriticalPoints((x) => Math.sin(100 * x), -5, 5);
    expect(pts.length).toBe(MAX_CRITICAL_POINTS);
    for (let i = 1; i < pts.length; i++) expect(pts[i].x).toBeGreaterThanOrEqual(pts[i - 1].x);
  });

  it('real extrema of small-amplitude curves are still found', () => {
    const pts = findExtrema((x) => 1e-3 * x * x, -5, 5);
    expect(pts.length).toBe(1);
    expect(pts[0].kind).toBe('min');
  });
});

describe('critical-points: flat, close, cusp and wide-interval extrema', () => {
  const xs = (f: (x: number) => number, a: number, b: number) =>
    findExtrema(f, a, b).map((p) => [p.kind, p.x] as const);

  it('finds flat (high-multiplicity) extrema', () => {
    // x^5 - 5x^4 - 240: max at 0 where f is flat to ~3e-4 in floating point, min at 4.
    const p = xs((x) => x ** 5 - 5 * x ** 4 - 240, -10, 10);
    expect(p.length).toBe(2);
    expect(p[0][0]).toBe('max');
    expect(Math.abs(p[0][1])).toBeLessThan(1e-6);
    expect(p[1][1]).toBeCloseTo(4, 6);
    const q = xs((x) => 5 / (x ** 4 + 5), -10, 10);
    expect(q.length).toBe(1);
    expect(Math.abs(q[0][1])).toBeLessThan(1e-6);
    const r = xs((x) => x ** 11 - 6 * x ** 10, -2, 10);
    expect(r.map((e) => e[0])).toEqual(['max', 'min']);
    expect(Math.abs(r[0][1])).toBeLessThan(1e-6);
    const t = xs((x) => (x - 6 / x) ** 8, -10, 10);
    expect(t.map((e) => e[0])).toEqual(['min', 'min']);
    expect(t[1][1]).toBeCloseTo(Math.sqrt(6), 5);
  });

  it('keeps two critical points 0.0014 apart', () => {
    const f = (x: number) => x ** 8 / 8 - 0.4 * x ** 5 - 5 * x - 5 / x ** 2 + 11;
    const p = xs(f, 0.5, 2);
    expect(p.length).toBe(2);
    expect(p[0][1]).toBeCloseTo(5 ** (1 / 7), 7);
    expect(p[1][1]).toBeCloseTo(2 ** (1 / 3), 7);
  });

  it('locates a cusp extremum on the corner, not where the smoothed f′ vanishes', () => {
    const p = xs((x) => 2 * x - 3 * Math.cbrt(x * x), -10, 10);
    expect(p.map((e) => e[0])).toEqual(['max', 'min']);
    expect(Math.abs(p[0][1])).toBeLessThan(1e-9);
    expect(p[1][1]).toBeCloseTo(1, 6);
  });

  it('finds an extremum of a large-valued curve on a wide interval', () => {
    const p = xs((x) => 180 * Math.sqrt(x * x + 640000) + 100 * (10560 - x), 0, 10560);
    expect(p.length).toBe(1);
    expect(p[0][0]).toBe('min');
    expect(p[0][1]).toBeCloseTo(800 / Math.sqrt(2.24), 4);
  });

  it('an inflection with f′ = 0 is not an extremum', () => {
    expect(findExtrema((x) => x ** 3, -2, 2)).toEqual([]);
  });
});
