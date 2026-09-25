import { describe, it, expect } from 'vitest';
import { derivative, areaSingle } from './calculus';

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
});
