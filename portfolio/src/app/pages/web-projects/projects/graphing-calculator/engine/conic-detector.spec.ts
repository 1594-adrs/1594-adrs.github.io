import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import { detectConic } from './conic-detector';
import type { ExpressionNode } from './parser';

function parseEquation(expr: string): ExpressionNode {
  const eqIdx = expr.indexOf('=');
  if (eqIdx === -1) throw new Error('No = in equation');
  const lhs = parse(expr.substring(0, eqIdx));
  const rhs = parse(expr.substring(eqIdx + 1));
  return { type: 'BinaryOp', operator: '=', left: lhs, right: rhs };
}

describe('conic-detector', () => {
  it('should detect x^2+y^2-1=0 as circle with r=1', () => {
    const ast = parseEquation('x^2+y^2-1=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.radius).toBeCloseTo(1, 10);
    expect(result!.center).toEqual({ x: 0, y: 0 });
  });

  it('should detect x^2+y^2-4=0 as circle with r=2', () => {
    const ast = parseEquation('x^2+y^2-4=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.radius).toBeCloseTo(2, 10);
  });

  it('should detect x^2/4+y^2/9-1=0 as ellipse with correct dimensions', () => {
    const ast = parseEquation('x^2/4+y^2/9-1=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ellipse');
    expect(result!.a).toBeCloseTo(3, 10);
    expect(result!.b).toBeCloseTo(2, 10);
  });

  it('should detect y-x^2=0 as parabola', () => {
    const ast = parseEquation('y-x^2=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('parabola');
    expect(result!.center).toEqual({ x: 0, y: 0 });
  });

  it('should detect x^2-y^2-1=0 as horizontal hyperbola', () => {
    const ast = parseEquation('x^2-y^2-1=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hyperbola');
    expect(result!.eccentricity).toBeGreaterThan(1);
    expect(result!.foci).toBeDefined();
    expect(result!.foci!.length).toBe(2);
    expect(result!.foci![0].y).toBe(result!.foci![1].y);
  });

  it('should detect vertical hyperbola y^2-x^2=1', () => {
    const ast = parseEquation('y^2-x^2-1=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hyperbola');
    expect(result!.eccentricity).toBeGreaterThan(1);
  });

  it('should return null for non-conic expressions', () => {
    const ast = parseEquation('sin(x)=0');
    const result = detectConic(ast);
    expect(result).toBeNull();
  });

  it('should return null for expressions without =', () => {
    const ast = parse('x+y');
    const result = detectConic(ast);
    expect(result).toBeNull();
  });

  it('should detect circle with non-zero center', () => {
    const ast = parseEquation('x^2+y^2-4x-6y+9=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.center).toEqual({ x: 2, y: 3 });
    expect(result!.radius).toBeCloseTo(2, 10);
  });

  it('should detect parabola y=x^2 with correct vertex', () => {
    const ast = parseEquation('y-x^2=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('parabola');
    expect(result!.center).toEqual({ x: 0, y: 0 });
  });

  it('should detect ellipse with correct aSq/bSq (non-zero center)', () => {
    const ast = parseEquation('9*x^2+4*y^2-18*x-16*y-11=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ellipse');
    expect(result!.a).toBeCloseTo(3, 5);
    expect(result!.b).toBeCloseTo(2, 5);
    expect(result!.center).toEqual({ x: 1, y: 2 });
  });

  it('should detect vertical hyperbola with correct foci', () => {
    const ast = parseEquation('y^2-x^2-1=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hyperbola');
    expect(result!.foci![0].x).toBeCloseTo(result!.foci![1].x, 5);
    expect(result!.foci![0].y).not.toBeCloseTo(result!.foci![1].y, 5);
  });

  it('should detect vertical hyperbola y²/4 - x²/9 = 1', () => {
    const ast = parseEquation('9*y^2-4*x^2-36=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hyperbola');
    expect(result!.a).toBeCloseTo(2, 5);
    expect(result!.b).toBeCloseTo(3, 5);
  });
});
