import { describe, it, expect } from 'vitest';
import {
  derivative,
  solidVolume,
  solidSurfaceArea,
  areaBetweenCurves,
  areaBetweenCurvesWithRegions,
} from './calculus';

describe('calculus', () => {
  describe('derivative', () => {
    it('should compute derivative of x^2 at x=1 ≈ 2', () => {
      expect(derivative((x) => x * x, 1)).toBeCloseTo(2, 2);
    });

    it('should compute derivative of sin(x) at x=0 ≈ 1', () => {
      expect(derivative(Math.sin, 0)).toBeCloseTo(1, 2);
    });

    it('should compute derivative of constant = 0', () => {
      expect(derivative(() => 5, 3)).toBeCloseTo(0, 4);
    });
  });

  describe('solidVolume', () => {
    it('should compute volume around y=0 for f(x)=1 from 0 to 1 ≈ π', () => {
      const vol = solidVolume(() => 1, 0, 1, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI, 2);
    });

    it('should compute volume around y=1 for f(x)=1 from 0 to 1 ≈ 0', () => {
      const vol = solidVolume(() => 1, 0, 1, { type: 'x', value: 1 });
      expect(vol).toBeCloseTo(0, 2);
    });

    it('should compute volume around y=0 for f(x)=x from 0 to 1 ≈ π/3', () => {
      const vol = solidVolume((x) => x, 0, 1, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI / 3, 2);
    });

    it('should compute volume around y=2 for f(x)=1 from 0 to 1 ≈ π', () => {
      const vol = solidVolume(() => 1, 0, 1, { type: 'x', value: 2 });
      expect(vol).toBeCloseTo(Math.PI, 2);
    });

    it('should default to axis y=0', () => {
      const vol = solidVolume(() => 1, 0, 1);
      expect(vol).toBeCloseTo(Math.PI, 2);
    });
  });

  describe('solidSurfaceArea', () => {
    it('should compute surface area around y=0 for f(x)=1 from 0 to 1 ≈ 2π', () => {
      const sa = solidSurfaceArea(() => 1, 0, 1, { type: 'x', value: 0 });
      expect(sa).toBeCloseTo(2 * Math.PI, 1);
    });

    it('should compute surface area around y=1 for f(x)=1 ≈ 0', () => {
      const sa = solidSurfaceArea(() => 1, 0, 1, { type: 'x', value: 1 });
      expect(sa).toBeCloseTo(0, 1);
    });
  });

  describe('areaBetweenCurves', () => {
    it('should compute area between f=1 and g=0 from 0 to 1 ≈ 1', () => {
      const area = areaBetweenCurves(
        () => 1,
        () => 0,
        0,
        1,
      );
      expect(area).toBeCloseTo(1, 3);
    });

    it('should compute area between f=x and g=0 from 0 to 1 ≈ 0.5', () => {
      const area = areaBetweenCurves(
        (x) => x,
        () => 0,
        0,
        1,
      );
      expect(area).toBeCloseTo(0.5, 3);
    });

    it('should compute area between f=x and g=x/2 from 0 to 2 ≈ 1', () => {
      const area = areaBetweenCurves(
        (x) => x,
        (x) => x / 2,
        0,
        2,
      );
      expect(area).toBeCloseTo(1, 3);
    });

    it('should handle inverted curves (absolute value)', () => {
      const area = areaBetweenCurves(
        () => 0,
        () => 1,
        0,
        1,
      );
      expect(area).toBeCloseTo(1, 3);
    });
  });

  describe('edge cases', () => {
    it('derivative of discontinuous function should return finite value', () => {
      const f = (x: number) => (x > 0 ? 1 : -1);
      const d = derivative(f, 0);
      expect(isFinite(d)).toBe(true);
    });

    it('derivative of function with singularity should return 0', () => {
      const f = (x: number) => (x === 0 ? Infinity : 1 / x);
      const d = derivative(f, 0);
      expect(d).toBe(0);
    });

    it('solidVolume with singularity should return finite or inf', () => {
      const f = (x: number) => (x === 0 ? Infinity : 1 / Math.sqrt(x));
      const vol = solidVolume(f, 0, 1, { type: 'x', value: 0 });
      expect(isFinite(vol) || vol === Number.POSITIVE_INFINITY).toBe(true);
    });

    it('solidSurfaceArea with singularity should return finite or inf', () => {
      const f = (x: number) => (x === 0 ? Infinity : 1 / Math.sqrt(x));
      const sa = solidSurfaceArea(f, 0, 1, { type: 'x', value: 0 });
      expect(isFinite(sa) || sa === Number.POSITIVE_INFINITY).toBe(true);
    });

    it('areaBetweenCurves with one infinite function should return finite', () => {
      const fU = (x: number) => (x === 0 ? Infinity : 1 / (x * x));
      const area = areaBetweenCurves(fU, () => 0, 0.1, 1);
      expect(isFinite(area)).toBe(true);
    });

    it('solidVolume around vertical axis should return finite for bounded function', () => {
      const vol = solidVolume((x) => x, 0, 1, { type: 'y', value: 0 });
      expect(isFinite(vol)).toBe(true);
      expect(vol).toBeGreaterThan(0);
    });
  });

  describe('areaBetweenCurves with crossing curves', () => {
    it('should compute area between sin(x) and 0 from -π to π ≈ 4', () => {
      const area = areaBetweenCurves(Math.sin, () => 0, -Math.PI, Math.PI);
      expect(area).toBeCloseTo(4, 1);
    });

    it('should compute area between x² and x from 0 to 2 (crosses at x=1) = 1', () => {
      const area = areaBetweenCurves(
        (x) => x * x,
        (x) => x,
        0,
        2,
      );
      expect(area).toBeCloseTo(1, 2);
    });

    it('should compute area between sin(x) and cos(x) from 0 to 2π', () => {
      const area = areaBetweenCurves(Math.sin, Math.cos, 0, 2 * Math.PI);
      expect(area).toBeCloseTo(4 * Math.SQRT2, 1);
    });
  });

  describe('areaBetweenCurvesWithRegions', () => {
    it('should split x² and x from 0 to 2 at x=1 (crossing at x=0 is boundary)', () => {
      const result = areaBetweenCurvesWithRegions(
        (x) => x * x,
        (x) => x,
        0,
        2,
      );
      expect(result.regions.length).toBeGreaterThanOrEqual(2);
      expect(result.totalArea).toBeCloseTo(1, 2);
    });

    it('should compute correct total area for crossing curves', () => {
      const result = areaBetweenCurvesWithRegions(
        (x) => x * x,
        (x) => x,
        0,
        2,
      );
      expect(result.totalArea).toBeCloseTo(1, 2);
    });

    it('should handle non-crossing curves (single region)', () => {
      const result = areaBetweenCurvesWithRegions(
        () => 1,
        () => 0,
        0,
        1,
      );
      expect(result.regions.length).toBe(1);
      expect(result.totalArea).toBeCloseTo(1, 3);
    });

    it('should handle sin(x) vs cos(x) from 0 to 2π with crossing points', () => {
      const result = areaBetweenCurvesWithRegions(Math.sin, Math.cos, 0, 2 * Math.PI);
      expect(result.regions.length).toBeGreaterThanOrEqual(2);
      expect(result.totalArea).toBeCloseTo(4 * Math.SQRT2, 1);
    });
  });
});
