import { describe, it, expect } from 'vitest';
import { computeAreaRegions } from './area-splitter';
import { findIntersections, type IntersectionPoint } from './intersection-finder';

const PI = Math.PI;
const at = (x: number): IntersectionPoint[] => [{ x, y: 0, functionIndices: [0, 1] }];

describe('computeAreaRegions', () => {
  it('should produce 2 regions with one intersection', () => {
    const fns = [Math.sin, Math.cos];
    const intersections: IntersectionPoint[] = [
      { x: PI / 4, y: Math.sin(PI / 4), functionIndices: [0, 1] },
    ];
    const regions = computeAreaRegions(fns, intersections, 0, PI);
    expect(regions.length).toBe(2);
  });

  it('should produce 1 region with no intersection', () => {
    const fns = [(x: number) => x + 1, (x: number) => x + 2];
    const regions = computeAreaRegions(fns, [], 0, 5);
    expect(regions.length).toBe(1);
  });

  it('should identify correct top and bottom functions', () => {
    const fns = [Math.sin, Math.cos];
    const intersections: IntersectionPoint[] = [
      { x: PI / 4, y: Math.sin(PI / 4), functionIndices: [0, 1] },
    ];
    const regions = computeAreaRegions(fns, intersections, 0, PI);
    for (const region of regions) {
      expect(region.topFunctionIndex).not.toBe(region.bottomFunctionIndex);
    }
    const first = regions[0];
    expect(first.topFunctionIndex).toBe(1);
    expect(first.bottomFunctionIndex).toBe(0);
  });

  it('should produce positive area for all regions', () => {
    const fns = [Math.sin, Math.cos];
    const intersections: IntersectionPoint[] = [
      { x: PI / 4, y: Math.sin(PI / 4), functionIndices: [0, 1] },
    ];
    const regions = computeAreaRegions(fns, intersections, 0, PI);
    for (const region of regions) {
      expect(region.area).toBeGreaterThan(0);
    }
  });

  it('should handle singularities gracefully', () => {
    const throwing = (x: number) => {
      if (Math.abs(x - 2) < 0.01) throw new Error('singularity');
      return Math.sin(x);
    };
    const fns = [throwing, Math.cos];
    expect(() => computeAreaRegions(fns, [], 0, PI)).not.toThrow();
  });

  it('should handle functions returning NaN in region boundaries', () => {
    const fns = [(x: number) => (x > 3 ? NaN : x), (x: number) => 0];
    expect(() => computeAreaRegions(fns, [], 0, 5)).not.toThrow();
  });

  it('should compute area of a triangle-like region correctly', () => {
    const fns = [(x: number) => x, (x: number) => 0];
    const regions = computeAreaRegions(fns, [], 0, 2);
    expect(regions.length).toBe(1);
    expect(regions[0].area).toBeCloseTo(2, 0);
  });
});

describe('computeAreaRegions wave-1 (H4, H26)', () => {
  const total = (rs: ReturnType<typeof computeAreaRegions>) => rs.reduce((s, r) => s + r.area, 0);

  it('x^2 vs x+2 on [-1, 2] has area 4.5 within 1e-9', () => {
    const fns = [(x: number) => x * x, (x: number) => x + 2];
    const inter: IntersectionPoint[] = [
      { x: -1, y: 1, functionIndices: [0, 1] },
      { x: 2, y: 4, functionIndices: [0, 1] },
    ];
    const rs = computeAreaRegions(fns, inter, -1, 2);
    expect(Math.abs(total(rs) - 4.5)).toBeLessThan(1e-9);
    expect(rs.every((r) => r.status === 'ok')).toBe(true);
  });

  it('an intersection outside [a, b] does not create an out-of-range region (was 29.5 vs 1/6)', () => {
    const fns = [(x: number) => x * x, (x: number) => x];
    // true crossings are x=0 and x=1; area over [0, 1] is 1/6, but pass a far-away one too
    const inter: IntersectionPoint[] = [
      { x: 0, y: 0, functionIndices: [0, 1] },
      { x: 1, y: 1, functionIndices: [0, 1] },
      { x: 5, y: 5, functionIndices: [0, 1] },
      { x: -3, y: -3, functionIndices: [0, 1] },
    ];
    const rs = computeAreaRegions(fns, inter, 0, 1);
    expect(total(rs)).toBeCloseTo(1 / 6, 9);
    for (const r of rs) {
      expect(r.a).toBeGreaterThanOrEqual(0);
      expect(r.b).toBeLessThanOrEqual(1);
    }
  });

  it('duplicate / coincident intersections do not create empty regions', () => {
    const fns = [(x: number) => x * x, (x: number) => x];
    const inter: IntersectionPoint[] = [
      { x: 0.5, y: 0.25, functionIndices: [0, 1] },
      { x: 0.5, y: 0.25, functionIndices: [0, 1] },
    ];
    const rs = computeAreaRegions(fns, inter, 0, 1);
    expect(rs.length).toBe(2);
    expect(total(rs)).toBeCloseTo(1 / 6, 9);
  });

  it('propagates divergence: area between 1/x and 0 on [0, 1] is Infinity, status divergent, never 0', () => {
    const rs = computeAreaRegions([(x) => 1 / x, () => 0], [], 0, 1);
    expect(rs.length).toBe(1);
    expect(rs[0].status).toBe('divergent');
    expect(rs[0].area).toBe(Infinity);
    expect(rs[0].badPoint).toBeDefined();
  });

  it('propagates undefined: sqrt(x) vs -sqrt(x) shifted off its domain is NaN, not 0', () => {
    const rs = computeAreaRegions([(x) => Math.sqrt(x - 5), (x) => Math.sqrt(x - 5) - 1], [], 0, 4);
    // both curves are undefined on the whole interval, so no region can be formed
    expect(rs.every((r) => r.status !== 'ok' || Number.isFinite(r.area))).toBe(true);
    expect(rs.some((r) => r.area === 0 && r.status === 'ok')).toBe(false);
  });

  it('degenerate interval returns no regions', () => {
    expect(computeAreaRegions([(x) => x], [], 1, 1)).toEqual([]);
    expect(computeAreaRegions([(x) => x], [], 2, 1)).toEqual([]);
  });

  it('3 curves: area of the band that closes at both limits, not the envelope (e, e^x, e^-x → 2)', () => {
    const fns = [() => Math.E, Math.exp, (x: number) => Math.exp(-x)];
    const rs = computeAreaRegions(fns, at(0), -1, 1);
    expect(rs.reduce((s, r) => s + r.area, 0)).toBeCloseTo(2, 8);
    expect(rs.every((r) => r.topFunctionIndex === 0)).toBe(true);
  });

  it('3 curves: closing band at the bottom (12-x, sqrt x, 1 on [1, 11] → 34/3)', () => {
    const fns = [(x: number) => 12 - x, Math.sqrt, () => 1];
    const rs = computeAreaRegions(fns, at(9), 1, 11);
    expect(rs.reduce((s, r) => s + r.area, 0)).toBeCloseTo(34 / 3, 8);
    expect(rs.every((r) => r.bottomFunctionIndex === 2)).toBe(true);
  });

  it('3 curves with no single closing band keep the envelope', () => {
    const fns = [() => 2, () => 1, () => 0];
    const rs = computeAreaRegions(fns, [], 0, 1);
    expect(rs[0].area).toBeCloseTo(2, 12);
  });

  it('a curve undefined in part of [a, b] yields an undefined region, not area 0 ok (sqrt, 0 on [-1, 1])', () => {
    const fns = [Math.sqrt, () => 0];
    for (const inter of [findIntersections(fns, -1, 1), at(0)]) {
      const rs = computeAreaRegions(fns, inter, -1, 1);
      const left = rs.filter((r) => r.a < 0);
      expect(left.length).toBeGreaterThan(0);
      for (const r of left) {
        expect(r.status).toBe('undefined');
        expect(r.area).toBeNaN();
        expect(r.badPoint).toBeDefined();
      }
      expect(rs.some((r) => r.area === 0 && r.status === 'ok')).toBe(false);
    }
  });

  it('a removable hole at the midpoint does not zero the region (sin(x)/x vs 0 on [-1, 1] → 1.892)', () => {
    const rs = computeAreaRegions([(x) => Math.sin(x) / x, () => 0], [], -1, 1);
    expect(rs.length).toBe(1);
    expect(rs[0].topFunctionIndex).toBe(0);
    expect(rs[0].bottomFunctionIndex).toBe(1);
    expect(rs[0].status).toBe('ok');
    expect(rs[0].area).toBeCloseTo(1.892166140734366, 9);
  });
});
