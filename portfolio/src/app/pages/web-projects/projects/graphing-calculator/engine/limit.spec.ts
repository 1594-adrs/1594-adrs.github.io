import { describe, it, expect } from 'vitest';
import { computeLimit, LIMIT_SAMPLES_PER_SIDE, type LimitResult } from './limit';
import { compileExpression } from './evaluator';
import { parse } from './parser';

const fn = (expr: string) => {
  const g = compileExpression(parse(expr));
  return (x: number) => g(x, NaN);
};
const lim = (expr: string, x0: number, side?: '-' | '+') => computeLimit(fn(expr), x0, side);

const expectFinite = (r: LimitResult, value: number) => {
  expect(r.status).toBe('finite');
  expect(Math.abs(r.value - value)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(value)));
};
const expectStatus = (r: LimitResult, status: 'dne' | 'unknown') => {
  expect(r.status).toBe(status);
  expect(r.value).toBeNaN();
};

describe('computeLimit', () => {
  describe('finite limits', () => {
    it.each([
      ['(sqrt(x)-root(3,x))/(x-1)', 1, 1 / 6], // removable 0/0 with heavy cancellation
      ['sin(x)/x', 0, 1],
      ['(1-cos(x))/x^2', 0, 0.5],
      ['(exp(x)-x-1)/x^2', 0, 0.5],
      ['(x^2-1E-6)/(x-1E-3)', 1e-3, 2e-3],
      ['x*sin(1/x)', 0, 0], // squeeze
      ['x^2', 1e6, 1e12],
    ])('%s at %d', (expr, x0, value) => expectFinite(lim(expr, x0), value));

    it('squeezes sqrt(x)*sin(1/x) from the right', () => {
      expectFinite(lim('sqrt(x)*sin(1/x)', 0, '+'), 0);
    });

    it('extrapolates log-rate convergence: ln(2x)/ln(x) at inf = 1', () => {
      expectFinite(lim('ln(2*x)/ln(x)', Infinity), 1);
    });
  });

  describe('x0 = ±inf', () => {
    it('(1+1/x)^x → e from both directions', () => {
      expectFinite(lim('(1+1/x)^x', Infinity), Math.E);
      expectFinite(lim('(1+1/x)^x', -Infinity), Math.E);
    });

    it.each([
      ['(3*x^2-x+2)/(5*x^2+4)', Infinity, 0.6],
      ['(3*x^2-x+2)/(5*x^2+4)', -Infinity, 0.6],
      ['(2*x+1)/(x^3-7)', -Infinity, 0],
      ['sqrt(x^2+x)-x', Infinity, 0.5],
      ['exp(-x)', Infinity, 0],
    ])('%s at %d', (expr, x0, value) => expectFinite(lim(expr, x0), value));

    it('rational growth keeps its sign at each end', () => {
      expect(lim('x^3-1000*x^2', Infinity)).toEqual({ value: Infinity, status: 'infinite' });
      expect(lim('x^3-1000*x^2', -Infinity)).toEqual({ value: -Infinity, status: 'infinite' });
      expect(lim('x/ln(x)', Infinity).value).toBe(Infinity);
    });

    it('bounded oscillation at inf does not exist; damped oscillation is 0', () => {
      expectStatus(lim('sin(x)', Infinity), 'dne');
      expectFinite(lim('sin(x)/x', Infinity), 0);
    });

    it('ignores side for an infinite x0', () => {
      expectFinite(lim('1/x', Infinity, '-'), 0);
    });
  });

  describe('one-sided and two-sided', () => {
    it('jump (x^2-1)/abs(x-1) at 1', () => {
      expectFinite(lim('(x^2-1)/abs(x-1)', 1, '-'), -2);
      expectFinite(lim('(x^2-1)/abs(x-1)', 1, '+'), 2);
      expectStatus(lim('(x^2-1)/abs(x-1)', 1), 'dne');
    });

    it('2/(3*root(3,x)) at 0: +inf from the right, -inf from the left, dne two-sided', () => {
      expect(lim('2/(3*root(3,x))', 0, '+').value).toBe(Infinity);
      expect(lim('2/(3*root(3,x))', 0, '-').value).toBe(-Infinity);
      expectStatus(lim('2/(3*root(3,x))', 0), 'dne');
    });

    it('1/root(3,x^2) at 0 → +inf on both sides', () => {
      expect(lim('1/root(3,x^2)', 0)).toEqual({ value: Infinity, status: 'infinite' });
    });

    it('5/(1-exp(1/x)) at 0: sides 0 and 5, two-sided dne', () => {
      expectFinite(lim('5/(1-exp(1/x))', 0, '+'), 0);
      expectFinite(lim('5/(1-exp(1/x))', 0, '-'), 5);
      expectStatus(lim('5/(1-exp(1/x))', 0), 'dne');
    });

    it('floor at an integer jumps; inside a step it is constant', () => {
      expectFinite(lim('floor(x)', 2, '-'), 1);
      expectFinite(lim('floor(x)', 2, '+'), 2);
      expectStatus(lim('floor(x)', 2), 'dne');
      expectFinite(lim('floor(x)', 2.5), 2);
      expectFinite(lim('x*floor(1/x)', 0, '+'), 1);
    });

    it('domain endpoint: two-sided equals the defined side (dataset convention)', () => {
      expectFinite(lim('sqrt(x)', 0), 0);
      expectFinite(lim('asin(x)', 1), Math.PI / 2);
      expect(lim('ln(x)', 0).value).toBe(-Infinity);
    });

    it('a one-sided limit from the undefined side does not exist', () => {
      expectStatus(lim('sqrt(x)', 0, '-'), 'dne');
      expectStatus(lim('ln(x)', 0, '-'), 'dne');
      expectStatus(
        computeLimit(() => NaN, 0),
        'dne',
      );
    });
  });

  describe('does not exist', () => {
    it.each([
      ['sin(1/x)', 0, undefined],
      ['sin(1/x)', 0, '+'],
      ['(1/x)*sin(1/x)', 0, '+'],
      ['1/x', 0, undefined],
      ['exp(1/x)', 0, undefined],
    ] as const)('%s at %d side %s', (expr, x0, side) => expectStatus(lim(expr, x0, side), 'dne'));
  });

  describe('robustness', () => {
    it('a blow-up that cancels to an exact 0 is still infinite: (1-cos(x))/x^4', () => {
      expect(lim('(1-cos(x))/x^4', 0)).toEqual({ value: Infinity, status: 'infinite' });
    });

    it('returns unknown instead of guessing when convergence is out of numeric reach', () => {
      // ln(ln x)/ln x → 0, but it is still 0.1 at x = 1e15.
      expectStatus(lim('ln(ln(x))/ln(x)', Infinity), 'unknown');
    });

    it('returns unknown when f throws or x0 is NaN', () => {
      const boom = () => {
        throw new Error('unknown identifier');
      };
      expectStatus(computeLimit(boom, 0), 'unknown');
      expectStatus(
        computeLimit((x) => x, NaN),
        'unknown',
      );
    });

    it.each([
      [0, undefined],
      [0, '+'],
      [Math.PI / 2, undefined],
      [Infinity, undefined],
    ] as const)('stays within the evaluation budget (x0 %d, side %s)', (x0, side) => {
      let calls = 0;
      const f = (x: number) => (calls++, Math.sin(1 / x));
      computeLimit(f, x0, side);
      const sides = side || !Number.isFinite(x0) ? 1 : 2;
      expect(calls).toBeLessThanOrEqual(sides * LIMIT_SAMPLES_PER_SIDE);
    });
  });
});
