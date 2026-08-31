import { describe, it, expect } from 'vitest';
import { computeAreaRegions, computeRevolutionRegions } from './area-splitter';
import type { IntersectionPoint } from './intersection-finder';

const PI = Math.PI;

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

describe('computeRevolutionRegions', () => {
  it('should produce 2 regions with one intersection', () => {
    const fns = [Math.sin, Math.cos];
    const intersections: IntersectionPoint[] = [
      { x: PI / 4, y: Math.sin(PI / 4), functionIndices: [0, 1] },
    ];
    const regions = computeRevolutionRegions(fns, intersections, 0, PI);
    expect(regions.length).toBe(2);
  });

  it('should produce 1 region with no intersection', () => {
    const fns = [(x: number) => x + 1, (x: number) => x + 2];
    const regions = computeRevolutionRegions(fns, [], 0, 5);
    expect(regions.length).toBe(1);
  });

  it('should identify correct top and bottom functions', () => {
    const fns = [Math.sin, Math.cos];
    const intersections: IntersectionPoint[] = [
      { x: PI / 4, y: Math.sin(PI / 4), functionIndices: [0, 1] },
    ];
    const regions = computeRevolutionRegions(fns, intersections, 0, PI);
    const first = regions[0];
    expect(first.topFunctionIndex).toBe(1);
    expect(first.bottomFunctionIndex).toBe(0);
  });

  it('should not include area field (unlike computeAreaRegions)', () => {
    const fns = [(x: number) => x, (x: number) => 0];
    const regions = computeRevolutionRegions(fns, [], 0, 2);
    expect(regions.length).toBe(1);
    expect(regions[0]).toHaveProperty('a');
    expect(regions[0]).toHaveProperty('b');
    expect(regions[0]).toHaveProperty('topFunctionIndex');
    expect(regions[0]).toHaveProperty('bottomFunctionIndex');
    expect(regions[0]).not.toHaveProperty('area');
  });

  it('should handle singularities gracefully', () => {
    const throwing = (x: number) => {
      if (Math.abs(x - 2) < 0.01) throw new Error('singularity');
      return Math.sin(x);
    };
    const fns = [throwing, Math.cos];
    expect(() => computeRevolutionRegions(fns, [], 0, PI)).not.toThrow();
  });

  it('should handle multiple intersections', () => {
    const fns = [(x: number) => Math.sin(x), (x: number) => 0];
    const intersections: IntersectionPoint[] = [
      { x: 0, y: 0, functionIndices: [0, 1] },
      { x: PI, y: 0, functionIndices: [0, 1] },
      { x: 2 * PI, y: 0, functionIndices: [0, 1] },
    ];
    const regions = computeRevolutionRegions(fns, intersections, 0, 2 * PI);
    expect(regions.length).toBeGreaterThanOrEqual(2);
  });

  describe('overlapMode: all', () => {
    it('should produce same result as pairwise for clean (no non-top/bot crossing) case', () => {
      const fns = [Math.sin, Math.cos];
      const intersections: IntersectionPoint[] = [
        { x: PI / 4, y: Math.sin(PI / 4), functionIndices: [0, 1] },
      ];
      const pairwise = computeRevolutionRegions(fns, intersections, 0, PI);
      const allMode = computeRevolutionRegions(fns, intersections, 0, PI, 'all');
      expect(pairwise.length).toBe(allMode.length);
    });

    it('should filter out regions where a non-top/bot function crosses top or bot', () => {
      const fns = [
        (x: number) => x + 2,
        (x: number) => x,
        (x: number) => 1.5,
      ];
      const intersections: IntersectionPoint[] = [];
      const pairwise = computeRevolutionRegions(fns, intersections, 0, 2);
      const allMode = computeRevolutionRegions(fns, intersections, 0, 2, 'all');
      expect(pairwise.length).toBeGreaterThanOrEqual(allMode.length);
    });
  });
});
