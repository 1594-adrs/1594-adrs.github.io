import { describe, it, expect } from 'vitest';
import { compileExpression } from './evaluator';
import { parse } from './parser';
import {
  DifferentialError,
  lineAt,
  newton,
  slopeAt,
  slopeFormula,
  tangentLine,
  type DifferentialCurve,
} from './differential';

const P = parse;
const explicit = (s: string, at: number, order = 1): number =>
  slopeAt({ mode: 'explicit', f: P(s) }, at, { order }).value;

describe('differential: slopeAt', () => {
  it('explicit: real odd roots of negatives', () => {
    expect(explicit('root(3, x)', -8)).toBeCloseTo(1 / 12, 10);
  });

  it('explicit: jumps and cusps have no derivative', () => {
    expect(explicit('abs(x)/x', 0)).toBeNaN();
    expect(explicit('root(3, x^2)', 0)).toBeNaN();
    expect(explicit('abs(x)', 0)).toBeNaN();
  });

  it('explicit: vertical tangent keeps its sign; smooth |u| products are fine', () => {
    expect(explicit('root(3, x)', 0)).toBe(Infinity);
    expect(explicit('x*abs(x)', 0)).toBeCloseTo(0, 10);
  });

  it('explicit: higher orders', () => {
    expect(explicit('x^3', 2, 2)).toBeCloseTo(12, 8);
  });

  it('implicit x²+y²=25 at (3, −4): tangent and normal', () => {
    const c: DifferentialCurve = { mode: 'implicit', lhs: P('x^2 + y^2'), rhs: P('25') };
    const t = tangentLine(c, 3, { y0: -4 });
    expect(t.slope).toBeCloseTo(3 / 4, 10);
    expect(lineAt(t, 0)).toBeCloseTo(-25 / 4, 10);
    const n = tangentLine(c, 3, { y0: -4, normal: true });
    expect(n.slope).toBeCloseTo(-4 / 3, 10);
    expect(lineAt(n, 0)).toBeCloseTo(0, 10);
  });

  it('tangentLine snaps a rounding-noise slope to 0 so the normal is vertical', () => {
    const circle: DifferentialCurve = { mode: 'parametric', x: P('5*cos(t)'), y: P('5*sin(t)') };
    expect(tangentLine(circle, Math.PI / 2).slope).toBe(0);
    expect(tangentLine(circle, Math.PI / 2, { normal: true }).slope).toBe(Infinity);
    const sin: DifferentialCurve = { mode: 'explicit', f: P('sin(x)') };
    expect(tangentLine(sin, Math.PI / 2, { normal: true }).slope).toBe(Infinity);
    // Near-vertical stays vertical (quotient tolerance), normal horizontal.
    expect(tangentLine(circle, Math.PI).slope).toBe(Infinity);
    expect(tangentLine(circle, Math.PI, { normal: true }).slope).toBe(0);
  });

  it('implicit x²+y²=1: second derivative is −1/y³', () => {
    const c: DifferentialCurve = { mode: 'implicit', lhs: P('x^2 + y^2'), rhs: P('1') };
    expect(slopeAt(c, 0.6, { y0: 0.8, order: 2 }).value).toBeCloseTo(-1 / 0.8 ** 3, 8);
    const f2 = compileExpression(slopeFormula(c, 2));
    expect(f2(0.6, -0.8)).toBeCloseTo(1 / 0.8 ** 3, 8);
  });

  it('implicit: off-curve points and several roots are errors', () => {
    const c: DifferentialCurve = { mode: 'implicit', lhs: P('x^2 + y^2'), rhs: P('25') };
    expect(() => slopeAt(c, 3, { y0: 1 })).toThrow(DifferentialError);
    const amb: DifferentialCurve = { mode: 'implicit', lhs: P('tan(x*y)'), rhs: P('y') };
    expect(() => slopeAt(amb, Math.PI / 4)).toThrow(DifferentialError);
  });

  it('parametric (t²−1, t³−t) at t=0: vertical tangent', () => {
    const c: DifferentialCurve = { mode: 'parametric', x: P('t^2 - 1'), y: P('t^3 - t') };
    expect(slopeAt(c, 0).value).toBe(Infinity);
  });

  it('polar r = 1 − 3cos t at 3π/4', () => {
    const c: DifferentialCurve = { mode: 'polar', r: P('1 - 3*cos(t)') };
    expect(slopeAt(c, (3 * Math.PI) / 4).value).toBeCloseTo(Math.SQRT2 / (6 + Math.SQRT2), 10);
  });

  it('x = −y³ − y + 2 at x = −8 (unique y = 2)', () => {
    const s = slopeAt({ mode: 'explicit-y', g: P('-y^3 - y + 2') }, -8);
    expect(s.y).toBeCloseTo(2, 8);
    expect(s.value).toBeCloseTo(-1 / 13, 10);
  });
});

describe('differential: newton', () => {
  it('x² − 2 from 1, 3 steps → 577/408', () => {
    expect(newton(P('x^2 - 2'), 1, 3).value).toBeCloseTo(577 / 408, 14);
  });

  it('∛x from 1, 3 steps → −8 (iterates double and flip)', () => {
    expect(newton(P('root(3, x)'), 1, 3).value).toBeCloseTo(-8, 10);
  });

  it('converges to a root without a step count', () => {
    const r = newton(P('x^2 - 10'), 3);
    expect(r.status).toBe('converged');
    expect(r.value).toBeCloseTo(Math.sqrt(10), 12);
  });

  it('detects a 2-cycle and divergence', () => {
    const c = newton(P('4*x^4 - 4*x^2'), Math.sqrt(21) / 7);
    expect(c.status).toBe('cycle');
    expect(c.value).toBeNaN();
    expect(newton(P('exp(x)'), 1).status).toBe('diverged');
  });
});
