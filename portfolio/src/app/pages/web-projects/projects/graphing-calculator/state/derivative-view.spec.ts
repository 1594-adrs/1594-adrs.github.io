import { describe, it, expect } from 'vitest';
import { parse } from '../engine/parser';
import { toExpressionString } from '../engine/symbolic-diff';
import type { MathExpression } from '../models/calculator.models';
import {
  RADIANS_REASON,
  derivativeOf,
  lineEquation,
  tangentAt,
  usesAngleUnit,
} from './derivative-view';

function row(raw: string, mode: MathExpression['mode'] = 'explicit'): MathExpression {
  return { raw, ast: parse(raw), color: '#00ff88', visible: true, mode, error: null };
}

describe('derivative-view', () => {
  it('differentiates explicit rows (sin x, x^3 - 3x)', () => {
    const sin = derivativeOf(row('sin(x)'), 'rad');
    expect(sin.reason).toBeNull();
    expect(toExpressionString(sin.ast!)).toBe('cos(x)');
    const cubic = derivativeOf(row('x^3-3*x'), 'rad');
    expect(cubic.ast).not.toBeNull();
  });

  it('explains instead of throwing for gamma / factorial', () => {
    const g = derivativeOf(row('gamma(x)'), 'rad');
    expect(g.ast).toBeNull();
    expect(g.applicable).toBe(true);
    expect(g.reason).toMatch(/No symbolic derivative/);
  });

  it('is not applicable to non-explicit rows and needs a parsed AST', () => {
    expect(derivativeOf(row('x', 'polar'), 'rad').applicable).toBe(false);
    const empty = { ...row('x'), ast: null };
    expect(derivativeOf(empty, 'rad').reason).toMatch(/valid/);
  });

  it('refuses trig in DEG mode but allows polynomials', () => {
    expect(derivativeOf(row('sin(x)'), 'deg').reason).toBe(RADIANS_REASON);
    expect(derivativeOf(row('x^2'), 'deg').reason).toBeNull();
    expect(usesAngleUnit(parse('2*atan(x)+1'))).toBe(true);
    expect(usesAngleUnit(parse('exp(x)*x'))).toBe(false);
  });

  it('formats line equations', () => {
    expect(lineEquation(1, 1, 2)).toBe('y = 2x - 1');
    expect(lineEquation(0, 0, -1)).toBe('y = -x');
    expect(lineEquation(2, 3, 0)).toBe('y = 3');
    expect(lineEquation(1, 2, 1)).toBe('y = x + 1');
    expect(lineEquation(0, 1, 0.99999999)).toBe('y = x + 1');
    expect(lineEquation(1.5, 0, Infinity)).toBe('x = 1.5');
  });

  it('gives the tangent of y = x^2 at x = 1 with its normal', () => {
    const t = tangentAt(row('x^2'), 1, undefined, 'rad', true)!;
    expect(t.kind).toBe('finite');
    expect(t.slope).toBeCloseTo(2, 9);
    expect(t.lines).toEqual(['(1, 1)', 'm = 2', 'y = 2x - 1', 'normal: y = -0.5x + 1.5']);
  });

  it('handles a polar row by its angle (r = 2 at θ = 0 has a vertical tangent)', () => {
    const t = tangentAt(row('2', 'polar'), 0, undefined, 'rad', false)!;
    expect(t.kind).toBe('vertical');
    expect(t.lines).toContain('x = 2');
  });

  it('reports a corner as "does not exist", with no line', () => {
    const t = tangentAt(row('abs(x)'), 0, undefined, 'rad', false)!;
    expect(t.kind).toBe('dne');
    expect(t.lines[1]).toBe('slope does not exist');
  });

  it('handles x = g(y) rows with the traced y', () => {
    const t = tangentAt(row('y^2', 'explicit-y'), 4, 2, 'rad', false)!;
    expect(t.slope).toBeCloseTo(0.25, 6);
  });

  it('snaps a rounding-noise slope to 0: horizontal tangent, vertical normal', () => {
    // (5cos t, 5sin t) at t = π/2: dy/dt = 5cos(π/2) ≈ 3e-16, not exactly 0.
    const circle: MathExpression = {
      ...row('0'),
      ast: null,
      mode: 'parametric',
      paramX: parse('5*cos(t)'),
      paramY: parse('5*sin(t)'),
    };
    const t = tangentAt(circle, Math.PI / 2, undefined, 'rad', true)!;
    expect(t.kind).toBe('finite');
    expect(t.slope).toBe(0);
    expect(t.lines).toEqual(['(0, 5)', 'm = 0', 'y = 5', 'normal: x = 0']);
    const sin = tangentAt(row('sin(x)'), Math.PI / 2, undefined, 'rad', true)!;
    expect(sin.lines.slice(2)).toEqual(['y = 1', 'normal: x = 1.570796']);
  });

  it('reports a row undefined everywhere instead of f′ = 0', () => {
    for (const raw of ['1/0', 'sqrt(-1)', 'ln(0)']) {
      const d = derivativeOf(row(raw), 'rad');
      expect(d.ast).toBeNull();
      expect(d.reason).toBe('f is undefined everywhere.');
      expect(d.note).toBeNull();
    }
    expect(derivativeOf(row('5'), 'rad').reason).toBeNull();
  });

  it('notes the jumps / corners where the f′ formula hides that f′ is undefined', () => {
    expect(derivativeOf(row('floor(x)'), 'rad').note).toBe(
      'f′ is undefined at the jumps of floor.',
    );
    expect(derivativeOf(row('x*sign(x-1)+ceil(2*x)'), 'rad').note).toBe(
      'f′ is undefined at the jumps of sign and ceil.',
    );
    expect(derivativeOf(row('round(x)+max(x,1)'), 'rad').note).toBe(
      'f′ is undefined at the jumps of round and the corners of max.',
    );
    expect(derivativeOf(row('x*(x>1)'), 'rad').note).toBe(
      'f′ is undefined at the jumps of the comparison.',
    );
    expect(derivativeOf(row('mod(x,2)'), 'rad').note).toBe('f′ is undefined at the jumps of mod.');
    // A constant argument has no jump; smooth rows and |u| (NaN at its corner already) get none.
    expect(derivativeOf(row('x+floor(2.5)'), 'rad').note).toBeNull();
    expect(derivativeOf(row('x^2'), 'rad').note).toBeNull();
    expect(derivativeOf(row('abs(x)'), 'rad').note).toBeNull();
    expect(derivativeOf(row('gamma(x)+floor(x)'), 'rad').note).toBeNull();
  });

  it('is unavailable for trig rows in DEG mode and null for implicit rows', () => {
    expect(tangentAt(row('sin(x)'), 1, undefined, 'deg', false)!.kind).toBe('unavailable');
    expect(tangentAt(row('x^2+y^2-1', 'implicit'), 0, undefined, 'rad', false)).toBeNull();
  });
});
