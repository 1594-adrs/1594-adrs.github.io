import { describe, it, expect } from 'vitest';
import { detectAsymptotes } from './asymptote-detector';

describe('asymptote-detector', () => {
  it('should detect vertical asymptote for 1/(x-2)', () => {
    const fn = (x: number) => 1 / (x - 2);
    const result = detectAsymptotes(fn, -10, 10);
    const vertical = result.filter((a) => a.type === 'vertical');
    expect(vertical.length).toBeGreaterThan(0);
    expect(vertical.some((a) => Math.abs(a.value - 2) < 0.1)).toBe(true);
  });

  it('should detect horizontal asymptote for 1/x', () => {
    const fn = (x: number) => 1 / x;
    const result = detectAsymptotes(fn, -1000, 1000);
    const horizontal = result.filter((a) => a.type === 'horizontal');
    expect(horizontal.length).toBeGreaterThan(0);
    expect(horizontal.some((a) => Math.abs(a.value) < 0.01)).toBe(true);
  });

  it('should return empty for polynomial', () => {
    const fn = (x: number) => x * x + 1;
    const result = detectAsymptotes(fn, -10, 10);
    expect(result.length).toBe(0);
  });

  it('should detect vertical asymptote for tan(x)', () => {
    const fn = (x: number) => Math.tan(x);
    const result = detectAsymptotes(fn, -2, 2);
    const vertical = result.filter((a) => a.type === 'vertical');
    expect(vertical.length).toBeGreaterThan(0);
  });

  it('should NOT detect horizontal asymptote for sin(x) (oscillating)', () => {
    const fn = (x: number) => Math.sin(x);
    // Test with various viewport bounds to ensure no false positives
    const viewports = [
      [-10, 10],
      [-100, 100],
      [-1000, 1000],
      [0, 2 * Math.PI],
      [-2 * Math.PI, 2 * Math.PI],
    ];
    for (const [xMin, xMax] of viewports) {
      const result = detectAsymptotes(fn, xMin, xMax);
      const horizontal = result.filter((a) => a.type === 'horizontal');
      expect(horizontal.length).toBe(0);
    }
  });

  it('should NOT detect horizontal asymptote for cos(x) (oscillating)', () => {
    const fn = (x: number) => Math.cos(x);
    const viewports = [
      [-10, 10],
      [-100, 100],
      [-1000, 1000],
      [0, 2 * Math.PI],
      [-2 * Math.PI, 2 * Math.PI],
    ];
    for (const [xMin, xMax] of viewports) {
      const result = detectAsymptotes(fn, xMin, xMax);
      const horizontal = result.filter((a) => a.type === 'horizontal');
      expect(horizontal.length).toBe(0);
    }
  });

  it('should NOT detect horizontal asymptote for sin(x) + 0.1x (slowly growing oscillation)', () => {
    const fn = (x: number) => Math.sin(x) + 0.1 * x;
    const result = detectAsymptotes(fn, -100, 100);
    const horizontal = result.filter((a) => a.type === 'horizontal');
    expect(horizontal.length).toBe(0);
  });
});
