import { describe, it, expect } from 'vitest';
import { solveIvp, stepIvp, type OdeResult } from './ode';
import { compileExpression, type CompiledExpr } from './evaluator';
import { parse } from './parser';

const fy = (expr: string): CompiledExpr => compileExpression(parse(expr));

const expectClose = (r: OdeResult, value: number, rel = 1e-9) => {
  expect(r.status).toBe('ok');
  expect(Math.abs(r.value - value)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(value)));
};

describe('stepIvp', () => {
  it.each([
    // [f, x0, y0, xEnd, method, h, book value]
    ['y', 0, 1, 1, 'euler', 0.5, 2.25], // 1.5²
    ['y', 0, 1, 1, 'euler', 0.25, 1.25 ** 4],
    ['x + y', 0, 1, 0.2, 'euler', 0.1, 1.22], // 1.1, then 1.1 + 0.1·1.2
    ['y', 0, 1, -1, 'euler', 0.5, 0.25], // backwards: 0.5²
    ['y', 0, 1, -1, 'euler', -0.5, 0.25], // books write the backward step as h < 0
    ['y', 0, 1, 0.1, 'rk4', 0.1, 1 + 0.1 + 0.1 ** 2 / 2 + 0.1 ** 3 / 6 + 0.1 ** 4 / 24],
    ['x + y', 0, 1, 0.1, 'rk4', 0.1, 1.11034166666667],
  ] as const)('%s from (%d, %d) to %d by %s h=%d', (f, x0, y0, xEnd, method, h, want) => {
    expectClose(stepIvp(fy(f), x0, y0, xEnd, method, h), want, 1e-12);
  });

  it('rounds the step count so a rounded h lands on xEnd', () => {
    // 1/3 ≈ 0.333 → 3 steps of exactly 1/3.
    expectClose(stepIvp(fy('1'), 0, 0, 1, 'euler', 0.333), 1, 1e-15);
  });

  it('is exact-to-rounding for RK4 on a cubic (y′ = 3x²)', () => {
    expectClose(stepIvp(fy('3*x^2'), 0, 0, 2, 'rk4', 0.5), 8, 1e-14);
  });

  it('returns y0 when xEnd = x0', () => {
    expectClose(stepIvp(fy('y'), 1, 3, 1, 'rk4', 0.1), 3, 0);
  });

  it('reports a NaN slope as undefined and an overflow as blow-up', () => {
    const nan = stepIvp(fy('sqrt(1 - x)'), 0, 0, 2, 'euler', 0.5);
    expect(nan.status).toBe('undefined');
    expect(nan.value).toBeNaN();
    const inf = stepIvp(fy('1/x'), -1, 0, 1, 'euler', 0.5);
    expect(inf.status).toBe('blow-up');
    expect(inf.value).toBeNaN();
  });

  it('rejects an invalid step', () => {
    expect(() => stepIvp(fy('y'), 0, 1, 1, 'euler', 0)).toThrow(RangeError);
    expect(() => stepIvp(fy('y'), 0, 1, 1, 'euler', 1e-12)).toThrow(RangeError);
  });

  it('rejects h over twice the interval instead of returning y0', () => {
    expect(() => stepIvp(fy('y'), 0, 1, 0.1, 'euler', 1)).toThrow(RangeError);
    expect(() => stepIvp(fy('y'), 0, 1, 0.2, 'rk4', 0.5)).toThrow(RangeError);
  });
});

describe('solveIvp', () => {
  it.each([
    // [f, x0, y0, exact solution]
    ['x + y', 0, 1, (x: number) => 2 * Math.exp(x) - x - 1],
    ['2*x*y', 0, 0.5, (x: number) => 0.5 * Math.exp(x * x)],
    ['-x', 0, 1, (x: number) => 1 - (x * x) / 2], // crosses zero
    ['cos(x)', 0, 0, (x: number) => Math.sin(x)],
    ['-y + sin(x)', 0, 0, (x: number) => (Math.sin(x) - Math.cos(x) + Math.exp(-x)) / 2],
    ['y*cos(x)', 1, 2, (x: number) => 2 * Math.exp(Math.sin(x) - Math.sin(1))],
  ] as const)('y′ = %s from (%d, %d) on both sides', (f, x0, y0, exact) => {
    const xs = [x0 + 3.1, x0 - 0.7, x0, x0 + 0.01, x0 - 5.9, x0 + 5.95, x0 + 1];
    const res = solveIvp(fy(f), x0, y0, xs);
    expect(res).toHaveLength(xs.length);
    xs.forEach((x, i) => expectClose(res[i], exact(x)));
  });

  it('keeps the order of xs, duplicates included', () => {
    const xs = [2, -1, 2, 0.5, -3];
    const res = solveIvp(fy('y'), 0, 1, xs);
    xs.forEach((x, i) => expectClose(res[i], Math.exp(x)));
  });

  it('follows a solution of the ODE to a power-law singularity: y′ = y² blows up at x = 1', () => {
    const res = solveIvp(fy('y^2'), 0, 1, [0.5, 0.999, 1.5, 2, -4]);
    expectClose(res[0], 2);
    expectClose(res[1], 1000, 1e-7);
    for (const r of res.slice(2, 4)) {
      expect(r.status).toBe('blow-up');
      expect(r.value).toBeNaN();
    }
    expectClose(res[4], 0.2); // the other side is unaffected
  });

  it('stops at a singularity of f: y′ = 1/(x·sqrt(x²−1)) approaching x = 1 is blow-up', () => {
    const res = solveIvp(fy('1/(x*sqrt(x^2-1))'), 2, Math.PI / 3, [1.5, 1.0001, 0.5, -2]);
    expectClose(res[0], Math.acos(1 / 1.5));
    expectClose(res[1], Math.acos(1 / 1.0001), 1e-7);
    for (const r of res.slice(2)) {
      expect(r.status).toBe('blow-up');
      expect(r.value).toBeNaN();
    }
  });

  it.each([
    // [f, x0, y0, exact on the side of x0, singular point c, a point beyond c]
    ['2*y/x', 1, 1, (x: number) => x * x, 0, -0.7], // any Cx² continues it on x < 0
    ['(2*y-1)/(x+2)', 0, 1, (x: number) => 0.5 + (x + 2) ** 2 / 8, -2, -3.1],
  ] as const)('does not step across a singular point of y′ = %s', (f, x0, y0, exact, c, beyond) => {
    const before = x0 + 0.9 * (c - x0);
    const res = solveIvp(fy(f), x0, y0, [before, beyond]);
    expectClose(res[0], exact(before), 1e-8);
    expect(res[1].status).toBe('blow-up');
    expect(res[1].value).toBeNaN();
  });

  it('stays on y = 1 past the top of y′ = sqrt(1 − y²) (y′ ≥ 0 and y ≤ 1: the only continuation)', () => {
    const res = solveIvp(fy('sqrt(1-y^2)'), 0, 0, [1.4, 2.5]);
    expectClose(res[0], Math.sin(1.4), 1e-8);
    expectClose(res[1], 1, 1e-8);
  });

  it('is blow-up through a pole of f with finite values on both sides (y′ = 1/x)', () => {
    const [r] = solveIvp(fy('1/x'), 1, 0, [-1]);
    expect(r.status).toBe('blow-up');
  });

  it('is undefined where f stops being real with a tame slope (y′ = sqrt(1 − x²))', () => {
    const exact = (x: number) => (x * Math.sqrt(1 - x * x) + Math.asin(x)) / 2;
    const res = solveIvp(fy('sqrt(1-x^2)'), 0, 0, [0.9, 1.2, 3, -0.5, -1.1]);
    expectClose(res[0], exact(0.9), 1e-8);
    expectClose(res[3], exact(-0.5), 1e-8);
    for (const i of [1, 2, 4]) {
      expect(res[i].status).toBe('undefined');
      expect(res[i].value).toBeNaN();
    }
  });

  it('is undefined at once when f is not real at the start', () => {
    const [r] = solveIvp(fy('sqrt(-1-y^2)'), 0, 0, [1]);
    expect(r.status).toBe('undefined');
  });

  it('treats a throwing f like NaN', () => {
    const f: CompiledExpr = (x) => {
      if (x > 1) throw new Error('boom');
      return 1;
    };
    const res = solveIvp(f, 0, 0, [0.5, 2]);
    expectClose(res[0], 0.5);
    expect(res[1].status).toBe('undefined');
    expect(res[1].value).toBeNaN();
  });

  it('returns an empty array for no xs and y0 at x0', () => {
    expect(solveIvp(fy('y'), 0, 1, [])).toEqual([]);
    expect(solveIvp(fy('y'), 0, 1, [0])).toEqual([{ value: 1, status: 'ok' }]);
  });

  it('does not hang on a violently oscillating slope, and gives no value it cannot back', () => {
    const t = performance.now();
    const [r] = solveIvp(fy('sin(1/(x-0.5))'), 0, 0, [2]);
    expect(performance.now() - t).toBeLessThan(2000);
    // The integral is finite, but the steps collapse at x = 0.5: blow-up, not a guessed value.
    expect(r.status).toBe('blow-up');
    expect(r.value).toBeNaN();
  });

  it.each([
    // [f, x0, xs, exact at the last target]: y′ = f(x) is 0 to rounding until a narrow bump that
    // an uncapped step (×5 per step while the error reads 0) leapt over, reading ~1e-20 as 'ok'.
    ['exp(-30*x^2)', -10, [10], Math.sqrt(Math.PI / 30)],
    ['exp(-30*x^2)', -10, [0, 10], Math.sqrt(Math.PI / 30)], // same answer with an extra target
    ['exp(-100*(x-5)^2)', 0, [10], Math.sqrt(Math.PI) / 10],
    ['1/cosh(10*x)^2', -10, [10], Math.tanh(100) / 5],
    ['exp(-3*(x-12)^2)', 0, [20], 1.0233267079464885],
    ['exp(-30*(x-8)^2)', 0, [10], Math.sqrt(Math.PI / 30)],
  ] as const)('does not step over the bump of y′ = %s from x = %d', (f, x0, xs, want) => {
    const res = solveIvp(fy(f), x0, 0, xs);
    expectClose(res[res.length - 1], want, 1e-9);
  });
});
