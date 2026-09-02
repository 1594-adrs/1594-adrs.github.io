import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import { detectConic, detectConicDomain } from './conic-detector';
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

  it('should detect circle from assistant expression x^2+y^2=2^2', () => {
    const ast = parseEquation('x^2+y^2=2^2');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.radius).toBeCloseTo(2, 5);
    expect(result!.center).toEqual({ x: 0, y: 0 });
  });

  it('should detect circle from expanded assistant expression x^2+y^2-4=0', () => {
    const ast = parseEquation('x^2+y^2-4=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.radius).toBeCloseTo(2, 5);
  });

  it('should detect shifted circle from expanded form x^2+y^2-4x+4=0', () => {
    const ast = parseEquation('x^2+y^2-4*x+4=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.center!.x).toBeCloseTo(2, 5);
    expect(result!.center!.y).toBeCloseTo(0, 5);
    expect(result!.radius).toBeCloseTo(0, 5);
  });

  it('should detect ellipse with BinaryOp denominator (x^2/2^2+y^2/1^2=1)', () => {
    const ast = parseEquation('x^2/2^2+y^2/1^2=1');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ellipse');
    expect(result!.a).toBeCloseTo(2, 5);
    expect(result!.b).toBeCloseTo(1, 5);
  });

  it('should detect ellipse from expanded form 4*x^2+16*y^2-64=0', () => {
    const ast = parseEquation('4*x^2+16*y^2-64=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ellipse');
    expect(result!.a).toBeCloseTo(4, 5);
    expect(result!.b).toBeCloseTo(2, 5);
  });

  it('should return correct domain for circle x^2+y^2=2^2', () => {
    const ast = parseEquation('x^2+y^2=2^2');
    const domain = detectConicDomain(ast);
    expect(domain).not.toBeNull();
    expect(domain!.length).toBe(1);
    expect(domain![0].a).toBeCloseTo(-2, 5);
    expect(domain![0].b).toBeCloseTo(2, 5);
  });

  it('should return correct domain for ellipse x^2/2^2+y^2/1^2=1', () => {
    const ast = parseEquation('x^2/2^2+y^2/1^2=1');
    const domain = detectConicDomain(ast);
    expect(domain).not.toBeNull();
    expect(domain!.length).toBe(1);
    expect(domain![0].a).toBeCloseTo(-2, 5);
    expect(domain![0].b).toBeCloseTo(2, 5);
  });

  it('should detect circle from (-2)^2 expression x^2+y^2=(-2)^2', () => {
    const ast = parseEquation('x^2+y^2=(-2)^2');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    expect(result!.radius).toBeCloseTo(2, 5);
    expect(result!.center).toEqual({ x: 0, y: 0 });
  });

  it('should detect shifted parabola from expanded form x^2-4*x-4*y+8=0', () => {
    const ast = parseEquation('x^2-4*x-4*y+8=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('parabola');
    expect(result!.center!.x).toBeCloseTo(2, 5);
    expect(result!.center!.y).toBeCloseTo(1, 5);
  });

  it('should detect unshifted parabola from expanded form x^2-4*y=0', () => {
    const ast = parseEquation('x^2-4*y=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('parabola');
    expect(result!.center!.x).toBeCloseTo(0, 5);
    expect(result!.center!.y).toBeCloseTo(0, 5);
  });

  it('should detect hyperbola from -x^2+y^2-4=0', () => {
    const ast = parseEquation('-x^2+y^2-4=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hyperbola');
  });

  it('should detect hyperbola from x^2-y^2-1=0 via unary minus form', () => {
    const ast = parseEquation('-x^2+y^2-1=0');
    const result = detectConic(ast);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hyperbola');
    expect(result!.eccentricity).toBeGreaterThan(1);
  });

  describe('detectConicDomain', () => {
    it('should return domain for circle x²+y²-4=0', () => {
      const ast = parseEquation('x^2+y^2-4=0');
      const domain = detectConicDomain(ast);
      expect(domain).not.toBeNull();
      expect(domain!.length).toBe(1);
      expect(domain![0].a).toBeCloseTo(-2, 10);
      expect(domain![0].b).toBeCloseTo(2, 10);
    });

    it('should return domain for shifted circle x²+y²-4x-3=0 (center=(2,0), r=√7)', () => {
      const ast = parseEquation('x^2+y^2-4*x-3=0');
      const domain = detectConicDomain(ast);
      expect(domain).not.toBeNull();
      expect(domain!.length).toBe(1);
      const r = Math.sqrt(7);
      expect(domain![0].a).toBeCloseTo(2 - r, 5);
      expect(domain![0].b).toBeCloseTo(2 + r, 5);
    });

    it('should return domain for ellipse x²/4+y²/9-1=0', () => {
      const ast = parseEquation('x^2/4+y^2/9-1=0');
      const domain = detectConicDomain(ast);
      expect(domain).not.toBeNull();
      expect(domain!.length).toBe(1);
      expect(domain![0].a).toBeCloseTo(-2, 10);
      expect(domain![0].b).toBeCloseTo(2, 10);
    });

    it('should return null for vertical parabola y-x^2=0', () => {
      const ast = parseEquation('y-x^2=0');
      const domain = detectConicDomain(ast);
      expect(domain).toBeNull();
    });

    it('should return two ranges for horizontal hyperbola x²-y²-1=0', () => {
      const ast = parseEquation('x^2-y^2-1=0');
      const domain = detectConicDomain(ast);
      expect(domain).not.toBeNull();
      expect(domain!.length).toBe(2);
      expect(domain![0].a).toBeLessThan(domain![0].b);
      expect(domain![1].a).toBeLessThan(domain![1].b);
      expect(domain![0].b).toBeLessThan(domain![1].a);
      expect(domain![0].b).toBeCloseTo(-1, 5);
      expect(domain![1].a).toBeCloseTo(1, 5);
    });

    it('should return null for vertical hyperbola', () => {
      const ast = parseEquation('y^2-x^2-1=0');
      const domain = detectConicDomain(ast);
      expect(domain).toBeNull();
    });

    it('should return null for non-conic', () => {
      const ast = parse('sin(x)');
      const domain = detectConicDomain(ast);
      expect(domain).toBeNull();
    });
  });
});
