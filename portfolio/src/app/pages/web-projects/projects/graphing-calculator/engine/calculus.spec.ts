import { describe, it, expect } from 'vitest';
import {
  derivative,
  solidVolumeSingle,
  solidSurfaceAreaSingle,
  areaSingle,
  solidVolumeMulti,
  solidSurfaceAreaMulti,
} from './calculus';
import type { SolidRegion } from './calculus';

const PI = Math.PI;

describe('calculus', () => {
  describe('derivative', () => {
    it('should compute derivative of x^2 at x=1 ≈ 2', () => {
      expect(derivative((x: number) => x * x, 1)).toBeCloseTo(2, 2);
    });

    it('should compute derivative of sin(x) at x=0 ≈ 1', () => {
      expect(derivative(Math.sin, 0)).toBeCloseTo(1, 2);
    });

    it('should compute derivative of constant = 0', () => {
      expect(derivative(() => 5, 3)).toBeCloseTo(0, 4);
    });
  });

  describe('solidVolumeMulti', () => {
    it('should compute volume around y=0 for f(x)=1 from 0 to 1 ≈ π', () => {
      const fns = [(x: number) => 1, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI, 2);
    });

    it('should compute volume around y=1 for f(x)=1 and g(x)=1 ≈ 0', () => {
      const fns = [(x: number) => 1, (x: number) => 1];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 1 });
      expect(vol).toBeCloseTo(0, 2);
    });

    it('should compute volume around y=0 for f(x)=x from 0 to 1 ≈ π/3', () => {
      const fns = [(x: number) => x, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI / 3, 2);
    });

    it('should compute volume around y=2 for f(x)=1, g(x)=0 from 0 to 1 ≈ 3π (washer: outer=|0-2|=2, inner=|1-2|=1)', () => {
      const fns = [(x: number) => 1, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 2 });
      expect(vol).toBeCloseTo(3 * Math.PI, 2);
    });

    it('should return 0 for empty regions', () => {
      const fns = [(x: number) => x];
      const vol = solidVolumeMulti(fns, [], { type: 'x', value: 0 });
      expect(vol).toBe(0);
    });
  });

  describe('solidSurfaceAreaMulti', () => {
    it('should compute surface area around y=0 for f(x)=1, g(x)=0 from 0 to 1 ≈ 4π (lateral 2π + 2 caps)', () => {
      const fns = [(x: number) => 1, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const sa = solidSurfaceAreaMulti(fns, regions, { type: 'x', value: 0 });
      expect(sa).toBeCloseTo(4 * Math.PI, 0);
    });

    it('should compute surface area around y=1 for f(x)=1 and g(x)=1 ≈ 0', () => {
      const fns = [(x: number) => 1, (x: number) => 1];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const sa = solidSurfaceAreaMulti(fns, regions, { type: 'x', value: 1 });
      expect(sa).toBeCloseTo(0, 1);
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

    it('solidVolumeMulti with singularity should return finite or inf', () => {
      const f = (x: number) => (x === 0 ? Infinity : 1 / Math.sqrt(x));
      const fns = [f, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      expect(isFinite(vol) || vol === Number.POSITIVE_INFINITY).toBe(true);
    });

    it('solidSurfaceAreaMulti with singularity should return finite or inf', () => {
      const f = (x: number) => (x === 0 ? Infinity : 1 / Math.sqrt(x));
      const fns = [f, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const sa = solidSurfaceAreaMulti(fns, regions, { type: 'x', value: 0 });
      expect(isFinite(sa) || sa === Number.POSITIVE_INFINITY).toBe(true);
    });

    it('solidVolumeMulti around vertical axis should return finite for bounded function', () => {
      const fns = [(x: number) => x, (x: number) => 0];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 1 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'y', value: 0 });
      expect(isFinite(vol)).toBe(true);
      expect(vol).toBeGreaterThan(0);
    });
  });

  describe('solidVolumeSingle', () => {
    it('should compute volume of f(x)=1 from 0 to 1 around y=0 ≈ π', () => {
      const vol = solidVolumeSingle((x: number) => 1, 0, 1, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI, 2);
    });

    it('should compute volume of f(x)=x from 0 to 1 around y=0 ≈ π/3', () => {
      const vol = solidVolumeSingle((x: number) => x, 0, 1, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI / 3, 2);
    });

    it('should compute volume of f(x)=1 from 0 to 1 around y=2 (disc r=|1-2|=1)', () => {
      const vol = solidVolumeSingle((x: number) => 1, 0, 1, { type: 'x', value: 2 });
      expect(vol).toBeCloseTo(Math.PI, 2);
    });
  });

  describe('solidSurfaceAreaSingle', () => {
    it('should compute surface area of f(x)=1 from 0 to 1 around y=0 ≈ 2π (lateral only)', () => {
      const sa = solidSurfaceAreaSingle((x: number) => 1, 0, 1, { type: 'x', value: 0 });
      expect(sa).toBeCloseTo(2 * Math.PI, 0);
    });

    it('should return finite for bounded function', () => {
      const sa = solidSurfaceAreaSingle((x: number) => x * x, 0, 1, { type: 'y', value: 0 });
      expect(isFinite(sa)).toBe(true);
      expect(sa).toBeGreaterThan(0);
    });
  });

  describe('areaSingle', () => {
    it('should compute area of f(x)=x from 0 to 1 ≈ 0.5', () => {
      const area = areaSingle((x: number) => x, 0, 1);
      expect(area).toBeCloseTo(0.5, 4);
    });

    it('should compute area of f(x)=sin(x) from 0 to π ≈ 2', () => {
      const area = areaSingle(Math.sin, 0, PI);
      expect(area).toBeCloseTo(2, 4);
    });

    it('should compute area of f(x)=x^2 from 0 to 1 ≈ 1/3', () => {
      const area = areaSingle((x: number) => x * x, 0, 1);
      expect(area).toBeCloseTo(1 / 3, 4);
    });
  });

  describe('solidVolumeMulti with crossing curves', () => {
    it('should compute volume for region where top/bottom swap at crossing', () => {
      const fns = [(x: number) => x * x, (x: number) => x];
      const regions: SolidRegion[] = [
        { a: 0, b: 1, topFunctionIndex: 1, bottomFunctionIndex: 0 },
        { a: 1, b: 2, topFunctionIndex: 0, bottomFunctionIndex: 1 },
      ];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      expect(isFinite(vol)).toBe(true);
      expect(vol).toBeGreaterThan(0);
    });
  });

  describe('solidVolumeMulti disk method (topIdx === bottomIdx)', () => {
    it('should compute sphere volume for upper semicircle around y=0 (disk method)', () => {
      const r = 2;
      const upper = (x: number) => {
        const d = r * r - x * x;
        return d >= 0 ? Math.sqrt(d) : NaN;
      };
      const fns = [upper];
      const regions: SolidRegion[] = [{ a: -r, b: r, topFunctionIndex: 0, bottomFunctionIndex: 0 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      const expected = (4 / 3) * PI * r * r * r;
      expect(vol).toBeCloseTo(expected, 0);
    });

    it('should compute cylinder volume when top===bottom (disk method)', () => {
      const fns = [(x: number) => 1];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 0 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(Math.PI, 2);
    });

    it('should compute cone volume using disk method with single function', () => {
      const fns = [(x: number) => x];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 0 }];
      const vol = solidVolumeMulti(fns, regions, { type: 'x', value: 0 });
      expect(vol).toBeCloseTo(PI / 3, 2);
    });
  });

  describe('solidSurfaceAreaMulti disk method (topIdx === bottomIdx)', () => {
    it('should compute sphere surface area for upper semicircle', () => {
      const r = 2;
      const upper = (x: number) => {
        const d = r * r - x * x;
        return d >= 0 ? Math.sqrt(d) : NaN;
      };
      const fns = [upper];
      const regions: SolidRegion[] = [{ a: -r, b: r, topFunctionIndex: 0, bottomFunctionIndex: 0 }];
      const sa = solidSurfaceAreaMulti(fns, regions, { type: 'x', value: 0 });
      const expected = 4 * PI * r * r;
      expect(sa).toBeCloseTo(expected, 0);
    });

    it('should compute cylinder surface area (disk method, single function)', () => {
      const fns = [(x: number) => 1];
      const regions: SolidRegion[] = [{ a: 0, b: 1, topFunctionIndex: 0, bottomFunctionIndex: 0 }];
      const sa = solidSurfaceAreaMulti(fns, regions, { type: 'x', value: 0 });
      expect(sa).toBeCloseTo(2 * PI, 0);
    });
  });
});
