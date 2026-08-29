import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import { solveConicForY } from './conic-solver';
import type { ExpressionNode } from './parser';

function parseEquation(expr: string): ExpressionNode {
  const eqIdx = expr.indexOf('=');
  if (eqIdx === -1) throw new Error('No = in equation');
  const lhs = parse(expr.substring(0, eqIdx));
  const rhs = parse(expr.substring(eqIdx + 1));
  return { type: 'BinaryOp', operator: '=', left: lhs, right: rhs };
}

describe('conic-solver', () => {
  it('circle: x²+y²-4=0 → two branches', () => {
    const ast = parseEquation('x^2+y^2-4=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(2);
    expect(branches![0].fn(0)).toBeCloseTo(2, 5);
    expect(branches![1].fn(0)).toBeCloseTo(-2, 5);
    expect(branches![0].fn(2)).toBeCloseTo(0, 5);
    expect(branches![1].fn(2)).toBeCloseTo(0, 5);
  });

  it('ellipse: x²/4+y²/9-1=0 → two branches', () => {
    const ast = parseEquation('x^2/4+y^2/9-1=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(2);
    expect(branches![0].fn(0)).toBeCloseTo(3, 5);
    expect(branches![1].fn(0)).toBeCloseTo(-3, 5);
    expect(branches![0].fn(2)).toBeCloseTo(0, 5);
  });

  it('parabola opening up: y-x²=0 → one branch', () => {
    const ast = parseEquation('y-x^2=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(1);
    expect(branches![0].fn(0)).toBeCloseTo(0, 5);
    expect(branches![0].fn(2)).toBeCloseTo(4, 5);
  });

  it('parabola opening down: y+x²=0 → one branch', () => {
    const ast = parseEquation('y+x^2=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(1);
    expect(branches![0].fn(0)).toBeCloseTo(0, 5);
    expect(branches![0].fn(2)).toBeCloseTo(-4, 5);
  });

  it('parabola opening right: x-y²=0 → two branches', () => {
    const ast = parseEquation('x-y^2=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(2);
    expect(branches![0].fn(0)).toBeCloseTo(0, 5);
    expect(branches![1].fn(0)).toBeCloseTo(0, 5);
    expect(branches![0].fn(4)).toBeCloseTo(2, 5);
    expect(branches![1].fn(4)).toBeCloseTo(-2, 5);
  });

  it('parabola opening left: x+y²=0 → two branches', () => {
    const ast = parseEquation('x+y^2=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(2);
    expect(branches![0].fn(0)).toBeCloseTo(0, 5);
    expect(branches![1].fn(0)).toBeCloseTo(0, 5);
    expect(branches![0].fn(-4)).toBeCloseTo(2, 5);
    expect(branches![1].fn(-4)).toBeCloseTo(-2, 5);
  });

  it('horizontal hyperbola: x²-y²-1=0 → two branches', () => {
    const ast = parseEquation('x^2-y^2-1=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(2);
    expect(branches![0].fn(0)).toBeNull();
    expect(branches![1].fn(0)).toBeNull();
    expect(branches![0].fn(2)).toBeCloseTo(Math.sqrt(3), 5);
    expect(branches![1].fn(2)).toBeCloseTo(-Math.sqrt(3), 5);
  });

  it('vertical hyperbola: y²-x²-1=0 → two branches', () => {
    const ast = parseEquation('y^2-x^2-1=0');
    const branches = solveConicForY(ast);
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(2);
    expect(branches![0].fn(0)).toBeCloseTo(1, 5);
    expect(branches![1].fn(0)).toBeCloseTo(-1, 5);
  });

  it('non-conic expression: sin(x) → returns null', () => {
    const ast = parse('sin(x)');
    const branches = solveConicForY(ast);
    expect(branches).toBeNull();
  });

  it('degenerate conic: x²+y²=0 → returns null (r=0)', () => {
    const ast = parseEquation('x^2+y^2=0');
    const branches = solveConicForY(ast);
    expect(branches).toBeNull();
  });
});
