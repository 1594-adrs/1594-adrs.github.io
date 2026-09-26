import { describe, it, expect } from 'vitest';
import {
  detectAsymptotes,
  canHaveHorizontalAsymptote,
  canHaveObliqueAsymptote,
} from './asymptote-detector';
import { parse } from './parser';

describe('asymptote-detector', () => {
  it('should detect vertical asymptote for 1/(x-2)', () => {
    const fn = (x: number) => 1 / (x - 2);
    const ast = parse('1/(x-2)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const vertical = result.filter((a) => a.type === 'vertical');
    expect(vertical.length).toBeGreaterThan(0);
    expect(vertical.some((a) => Math.abs(a.value - 2) < 0.1)).toBe(true);
  });

  it('should detect horizontal asymptote for 1/x', () => {
    const fn = (x: number) => 1 / x;
    const ast = parse('1/x');
    const result = detectAsymptotes(fn, -1000, 1000, ast);
    const horizontal = result.filter((a) => a.type === 'horizontal');
    expect(horizontal.length).toBeGreaterThan(0);
    expect(horizontal.some((a) => Math.abs(a.value) < 0.01)).toBe(true);
  });

  it('should return empty for polynomial', () => {
    const fn = (x: number) => x * x + 1;
    const ast = parse('x^2 + 1');
    const result = detectAsymptotes(fn, -10, 10, ast);
    expect(result.length).toBe(0);
  });

  it('should detect vertical asymptote for tan(x)', () => {
    const fn = (x: number) => Math.tan(x);
    const ast = parse('tan(x)');
    const result = detectAsymptotes(fn, -2, 2, ast);
    const vertical = result.filter((a) => a.type === 'vertical');
    expect(vertical.length).toBeGreaterThan(0);
  });

  it('should NOT detect horizontal asymptote for sin(x) (trigonometric)', () => {
    const fn = (x: number) => Math.sin(x);
    const ast = parse('sin(x)');
    // Test with various viewport bounds to ensure no false positives
    const viewports = [
      [-10, 10],
      [-100, 100],
      [-1000, 1000],
      [0, 2 * Math.PI],
      [-2 * Math.PI, 2 * Math.PI],
    ];
    for (const [xMin, xMax] of viewports) {
      const result = detectAsymptotes(fn, xMin, xMax, ast);
      const horizontal = result.filter((a) => a.type === 'horizontal');
      expect(horizontal.length).toBe(0);
    }
  });

  it('should NOT detect horizontal asymptote for cos(x) (trigonometric)', () => {
    const fn = (x: number) => Math.cos(x);
    const ast = parse('cos(x)');
    const viewports = [
      [-10, 10],
      [-100, 100],
      [-1000, 1000],
      [0, 2 * Math.PI],
      [-2 * Math.PI, 2 * Math.PI],
    ];
    for (const [xMin, xMax] of viewports) {
      const result = detectAsymptotes(fn, xMin, xMax, ast);
      const horizontal = result.filter((a) => a.type === 'horizontal');
      expect(horizontal.length).toBe(0);
    }
  });

  it('should NOT detect horizontal asymptote for sin(x) + 0.1x (trigonometric)', () => {
    const fn = (x: number) => Math.sin(x) + 0.1 * x;
    const ast = parse('sin(x) + 0.1*x');
    const result = detectAsymptotes(fn, -100, 100, ast);
    const horizontal = result.filter((a) => a.type === 'horizontal');
    expect(horizontal.length).toBe(0);
  });

  it('should NOT detect horizontal asymptote for tan(x) (trigonometric)', () => {
    const fn = (x: number) => Math.tan(x);
    const ast = parse('tan(x)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const horizontal = result.filter((a) => a.type === 'horizontal');
    expect(horizontal.length).toBe(0);
  });

  it('should NOT detect oblique asymptote for sin(x)', () => {
    const fn = (x: number) => Math.sin(x);
    const ast = parse('sin(x)');
    const result = detectAsymptotes(fn, -100, 100, ast);
    const oblique = result.filter((a) => a.type === 'oblique');
    expect(oblique.length).toBe(0);
  });

  it('should detect oblique asymptote for (x^2+1)/x = x + 1/x', () => {
    const fn = (x: number) => (x * x + 1) / x;
    const ast = parse('(x^2+1)/x');
    const result = detectAsymptotes(fn, -100, 100, ast);
    const oblique = result.filter((a) => a.type === 'oblique');
    expect(oblique.length).toBeGreaterThan(0);
  });

  it('should NOT flag a removable hole as a vertical asymptote: (x^2-1)/(x-1) at x=1', () => {
    const fn = (x: number) => (x * x - 1) / (x - 1);
    const ast = parse('(x^2-1)/(x-1)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const vertical = result.filter((a) => a.type === 'vertical');
    expect(vertical.some((a) => Math.abs(a.value - 1) < 0.1)).toBe(false);
  });

  it('should NOT produce a bogus oblique y=x+1 for the removable-hole identity (x^2-1)/(x-1)', () => {
    const fn = (x: number) => (x * x - 1) / (x - 1);
    const ast = parse('(x^2-1)/(x-1)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const oblique = result.filter((a) => a.type === 'oblique');
    expect(oblique.length).toBe(0);
  });

  it('should detect horizontal asymptote y=2 for (2x^2+1)/(x^2-1)', () => {
    const fn = (x: number) => (2 * x * x + 1) / (x * x - 1);
    const ast = parse('(2x^2+1)/(x^2-1)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const horizontal = result.filter((a) => a.type === 'horizontal');
    expect(horizontal.length).toBeGreaterThan(0);
    expect(horizontal.some((a) => Math.abs(a.value - 2) < 0.01)).toBe(true);
  });

  it('should NOT produce a bogus near-zero-slope oblique for (2x^2+1)/(x^2-1) once its horizontal is found', () => {
    const fn = (x: number) => (2 * x * x + 1) / (x * x - 1);
    const ast = parse('(2x^2+1)/(x^2-1)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const oblique = result.filter((a) => a.type === 'oblique');
    expect(oblique.length).toBe(0);
  });

  it('should still detect the real vertical poles for (2x^2+1)/(x^2-1) at x=+-1', () => {
    const fn = (x: number) => (2 * x * x + 1) / (x * x - 1);
    const ast = parse('(2x^2+1)/(x^2-1)');
    const result = detectAsymptotes(fn, -10, 10, ast);
    const vertical = result.filter((a) => a.type === 'vertical');
    expect(vertical.some((a) => Math.abs(a.value - 1) < 0.1)).toBe(true);
    expect(vertical.some((a) => Math.abs(a.value + 1) < 0.1)).toBe(true);
  });
});

describe('detectAsymptotes memoization', () => {
  it('returns the same array reference on a repeated call with the same ast/fn and viewport', () => {
    const fn = (x: number) => 1 / x;
    const ast = parse('1/x');
    const first = detectAsymptotes(fn, -1000, 1000, ast);
    const second = detectAsymptotes(fn, -1000, 1000, ast);
    expect(second).toBe(first);
  });

  it('computes a fresh result for a different ast even if structurally identical', () => {
    const fn = (x: number) => 1 / x;
    const astA = parse('1/x');
    const astB = parse('1 / x '); // different source text -> different cache entry, different AST object
    const first = detectAsymptotes(fn, -1000, 1000, astA);
    const second = detectAsymptotes(fn, -1000, 1000, astB);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it('re-detects at full resolution after zooming far in, instead of reusing a stale coarse result', () => {
    // 1/(x - 500.5): at the wide [-1000, 1000] request, the padded sweep samples on
    // whole-integer x (padXMin = -1000 - 3000 = -4000, step = 1), so the two samples
    // straddling the pole (500 and 501) each land exactly 0.5 away from it — giving
    // |f| = 2 on both sides with a sign change but no >100 jump, which detectVertical
    // doesn't treat as a pole. The wide call is expected to miss it.
    const c = 500.5;
    const fn = (x: number) => 1 / (x - c);
    const ast = parse('1/(x-500.5)');

    const wide = detectAsymptotes(fn, -1000, 1000, ast);
    expect(wide.some((a) => a.type === 'vertical' && Math.abs(a.value - c) < 0.5)).toBe(false);

    // Zooming into a tight window around the pole shrinks the requested range to well
    // under 1/3 of the range the cached (coarse) result was computed for, so it must
    // be recomputed at full density rather than just filtering the stale wide result.
    const tight = detectAsymptotes(fn, 500, 501, ast);
    expect(tight.some((a) => a.type === 'vertical' && Math.abs(a.value - c) < 0.01)).toBe(true);
  });
});
