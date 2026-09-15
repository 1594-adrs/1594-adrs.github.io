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
});
