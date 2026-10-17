import { describe, it, expect } from 'vitest';
import { slopeAt } from './differential';
import { parse } from './parser';
import { taylorCoefficients, TaylorError } from './taylor';

const taylor = (expr: string, center: number, order: number) =>
  taylorCoefficients(parse(expr), center, order);

const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));

const expectSeries = (got: number[], expected: number[], tol = 1e-12) => {
  expect(got.length).toBe(expected.length);
  got.forEach((c, k) => {
    const e = expected[k];
    expect(Math.abs(c - e), `c_${k} = ${c}, expected ${e}`).toBeLessThanOrEqual(
      tol * Math.max(1, Math.abs(e)),
    );
  });
};

const series = (order: number, c: (k: number) => number) =>
  Array.from({ length: order + 1 }, (_, k) => c(k));
const odd = (c: (k: number) => number) => (k: number) => (k % 2 ? c(k) : 0);
const even = (c: (k: number) => number) => (k: number) => (k % 2 ? 0 : c(k));

describe('taylorCoefficients', () => {
  describe('elementary functions at 0', () => {
    it.each<[string, number, (k: number) => number]>([
      ['exp(x)', 8, (k) => 1 / fact(k)],
      ['e^x', 8, (k) => 1 / fact(k)],
      ['2^x', 6, (k) => Math.LN2 ** k / fact(k)],
      ['sin(x)', 9, odd((k) => (-1) ** ((k - 1) / 2) / fact(k))],
      ['cos(x)', 8, even((k) => (-1) ** (k / 2) / fact(k))],
      ['sinh(x)', 9, odd((k) => 1 / fact(k))],
      ['cosh(x)', 8, even((k) => 1 / fact(k))],
      ['ln(1 + x)', 8, (k) => (k === 0 ? 0 : (-1) ** (k + 1) / k)],
      ['1/(1 - x)', 8, () => 1],
      ['atan(x)', 9, odd((k) => (-1) ** ((k - 1) / 2) / k)],
      ['sqrt(1 + x)', 5, (k) => [1, 1 / 2, -1 / 8, 1 / 16, -5 / 128, 7 / 256][k]],
      ['asin(x)', 7, (k) => [0, 1, 0, 1 / 6, 0, 3 / 40, 0, 5 / 112][k]],
      ['acos(x)', 5, (k) => [Math.PI / 2, -1, 0, -1 / 6, 0, -3 / 40][k]],
      ['tanh(x)', 7, (k) => [0, 1, 0, -1 / 3, 0, 2 / 15, 0, -17 / 315][k]],
      ['asinh(x)', 5, (k) => [0, 1, 0, -1 / 6, 0, 3 / 40][k]],
      ['atanh(x)', 5, odd((k) => 1 / k)],
      ['sech(x)', 4, (k) => [1, 0, -1 / 2, 0, 5 / 24][k]],
      ['log(1 + x)', 3, (k) => [0, 1, -1 / 2, 1 / 3][k] / Math.LN10],
      ['logb(2, 1 + x)', 2, (k) => [0, 1, -1 / 2][k] / Math.LN2],
      ['atan2(x, 1)', 5, odd((k) => (-1) ** ((k - 1) / 2) / k)],
      ['x^3 - 2*x + 4', 5, (k) => [4, -2, 0, 1, 0, 0][k]],
    ])('%s', (expr, order, c) => {
      expectSeries(taylor(expr, 0, order), series(order, c));
    });

    it('cbrt, acosh, csch and coth at a regular center', () => {
      expectSeries(taylor('cbrt(x)', 8, 2), [2, 1 / 12, -1 / 288]);
      expectSeries(taylor('cbrt(x)', -8, 1), [-2, 1 / 12]);
      expectSeries(taylor('acosh(x)', 2, 1), [Math.acosh(2), 1 / Math.sqrt(3)]);
      const sh = Math.sinh(1);
      expectSeries(taylor('csch(x)', 1, 1), [1 / sh, -Math.cosh(1) / sh ** 2]);
      expectSeries(taylor('coth(x)', 1, 1), [Math.cosh(1) / sh, -1 / sh ** 2]);
    });

    it('new functions outside their domain give NaN', () => {
      expect(taylor('acosh(x)', 0.5, 2).every(Number.isNaN)).toBe(true);
      expect(taylor('atanh(x)', 1, 2).every(Number.isNaN)).toBe(true);
    });

    it('tan(x) to order 11', () => {
      const t = [0, 1, 0, 1 / 3, 0, 2 / 15, 0, 17 / 315, 0, 62 / 2835, 0, 1382 / 155925];
      expectSeries(taylor('tan(x)', 0, 11), t);
    });

    it('sec(x)^2, sec(x)·tan(x) and x/tan(x)', () => {
      expectSeries(taylor('sec(x)^2', 0, 8), [1, 0, 1, 0, 2 / 3, 0, 17 / 45, 0, 62 / 315]);
      expectSeries(taylor('sec(x)*tan(x)', 0, 5), [0, 1, 0, 5 / 6, 0, 61 / 120]);
      expectSeries(taylor('x/tan(x)', 0, 4), [1, 0, -1 / 3, 0, -1 / 45]);
    });
  });

  describe('compositions and powers', () => {
    it('exp(sin(x))', () => {
      expectSeries(taylor('exp(sin(x))', 0, 6), [1, 1, 1 / 2, 0, -1 / 8, -1 / 15, -1 / 240]);
    });

    it('sin^2(x) (powered call) equals sin(x)^2 and (1 − cos 2x)/2', () => {
      const want = [0, 0, 1, 0, -1 / 3, 0, 2 / 45];
      expectSeries(taylor('sin^2(x)', 0, 6), want);
      expectSeries(taylor('sin(x)^2', 0, 6), want);
      expectSeries(taylor('(1 - cos(2*x))/2', 0, 6), want);
    });

    it('ln(abs(sec(x) + tan(x))) is the Gudermannian inverse', () => {
      expectSeries(taylor('ln(abs(sec(x) + tan(x)))', 0, 7), [
        0,
        1,
        0,
        1 / 6,
        0,
        1 / 24,
        0,
        61 / 5040,
      ]);
    });

    it('x^x at 1 (general u^v)', () => {
      expectSeries(taylor('x^x', 1, 4), [1, 1, 1, 1 / 2, 1 / 3]);
    });

    it('binomial (1 + x)^50 and a negative power', () => {
      expectSeries(taylor('(1 + x)^50', 0, 3), [1, 50, 1225, 19600]);
      expectSeries(taylor('(x/2 + 1)^(-2)', 0, 3), [1, -1, 3 / 4, -1 / 2]);
    });
  });

  describe('non-zero centers', () => {
    it.each<[string, number, number[]]>([
      ['ln(x)', 1, [0, 1, -1 / 2, 1 / 3, -1 / 4]],
      ['1/x', 2, [1 / 2, -1 / 4, 1 / 8, -1 / 16]],
      ['sqrt(x)', 4, [2, 1 / 4, -1 / 64, 1 / 512]],
      ['sin(x)', Math.PI / 4, [1, 1, -1 / 2, -1 / 6].map((c) => c * Math.SQRT1_2)],
      ['cos(x)', 22 * Math.PI, [1, 0, -1 / 2, 0, 1 / 24, 0, -1 / 720]],
      ['atan(x)', Math.sqrt(3), [Math.PI / 3, 1 / 4, -Math.sqrt(3) / 16, 1 / 24]],
      ['1 + x + x^2', -1, [1, -1, 1]],
    ])('%s at %d', (expr, center, want) => {
      expectSeries(taylor(expr, center, want.length - 1), want, 1e-10);
    });

    it('odd roots of negatives are real', () => {
      const cbrt = [-2, 1 / 12, 1 / 288, 5 / 20736];
      expectSeries(taylor('root(3, x)', -8, 3), cbrt);
      expectSeries(taylor('x^(1/3)', -8, 3), cbrt);
      // x^(2/3) at −8 = 4, derivative 2/3·(−8)^(−1/3) = −1/3.
      expectSeries(taylor('x^(2/3)', -8, 1), [4, -1 / 3]);
    });
  });

  describe('removable singularities', () => {
    it.each<[string, number, number[]]>([
      ['sin(x)/x', 0, [1, 0, -1 / 6, 0, 1 / 120]],
      ['(1 - cos(x))/x^2', 0, [1 / 2, 0, -1 / 24, 0, 1 / 720]],
      ['sin(x)^3/x^3', 0, [1, 0, -1 / 2, 0, 13 / 120]],
      ['sin(x)/(x - pi)', Math.PI, [-1, 0, 1 / 6, 0, -1 / 120]],
    ])('%s at %d', (expr, center, want) => {
      expectSeries(taylor(expr, center, want.length - 1), want, 1e-10);
    });

    // At low order the truncated denominator is all zero: that asks for guard terms, not NaN.
    it.each<[string, number[]]>([
      ['(1 - cos(x))/x^2', [0.5, 0]],
      ['sin(x)^3/x^3', [1, 0, -0.5]],
      ['sin(x)/x', [1]],
      ['exp((sin(x) - x)/x^3)', [Math.exp(-1 / 6), 0]],
      ['atan((1 - cos(x))/x^2)', [Math.atan(0.5), 0]],
      ['sqrt(sin(x)/x)', [1]],
    ])('%s at 0 to order %#', (expr, want) => {
      expectSeries(taylor(expr, 0, want.length - 1), want, 1e-10);
    });

    it.each(['1/x^2', 'cot(x)', 'exp(1/x)'])('a pole at low order stays NaN: %s', (expr) => {
      for (const v of taylor(expr, 0, 1)) expect(v).toBeNaN();
    });
  });

  describe('non-analytic points are NaN', () => {
    it.each<[string, number]>([
      ['sqrt(x)', 0],
      ['sqrt(x)', -1],
      ['abs(x)', 0],
      ['1/x', 0],
      ['ln(x)', 0],
      ['ln(x)', -1],
      ['tan(x)', Math.PI / 2],
      ['csc(x)', Math.PI],
      ['asin(x)', 1],
      ['floor(x)', 1],
      ['round(x)', 0.5],
      ['sign(x)', 0],
      ['max(x, x^2)', 0],
      ['(-2)^x', 2],
      ['x < 1', 1],
      ['x*cot(x)', 0], // shortcut: no Laurent series, the pole of cot does not cancel
    ])('%s at %d', (expr, center) => {
      const c = taylor(expr, center, 3);
      expect(c).toHaveLength(4);
      for (const v of c) expect(v).toBeNaN();
    });
  });

  describe('branches and piecewise-constant functions', () => {
    it.each<[string, number, number[]]>([
      ['abs(x)', -2, [2, -1, 0]],
      ['abs(x^2)', 0, [0, 0, 1]],
      ['floor(x)', 0.5, [0, 0, 0]],
      ['ceil(x) + x', 0.5, [1.5, 1, 0]],
      ['sign(x - 3)', 2, [-1, 0, 0]],
      ['min(x, 2)', 0, [0, 1, 0]],
      ['max(x, x^2)', 2, [4, 4, 1]],
      ['mod(x, 3)', 4, [1, 1, 0]],
      ['(x > 1)*x', 2, [2, 1, 0]],
    ])('%s at %d', (expr, center, want) => {
      expectSeries(taylor(expr, center, 2), want);
    });
  });

  it('constant subtrees use the evaluator (factorial, ncr)', () => {
    expectSeries(taylor('factorial(3)*x + ncr(5, 2)', 0, 2), [10, 6, 0]);
  });

  it.each(['factorial(x)', 'gamma(x)', 'ncr(x, 2)', 'npr(5, x)'])(
    '%s throws TaylorError',
    (expr) => {
      expect(() => taylor(expr, 1, 2)).toThrow(TaylorError);
    },
  );

  it('rejects a non-integer or negative order', () => {
    expect(() => taylor('x', 0, -1)).toThrow(RangeError);
    expect(() => taylor('x', 0, 1.5)).toThrow(RangeError);
  });

  it('a non-finite center is NaN', () => {
    expect(taylor('x', Infinity, 1).every(Number.isNaN)).toBe(true);
  });

  it.each<[string, number]>([
    ['exp(sin(x))/x', 1.3],
    ['x^(2/3)*(x - 2)', 2],
    ['sqrt(x^2 + 9)', -4],
    ['sec(x)', -Math.PI / 4],
    ['(x - 1)/(4*x^2 + 1)', 0.5],
  ])('c_k·k! of %s at %d matches symbolic differentiation', (expr, center) => {
    const c = taylor(expr, center, 3);
    for (let k = 1; k <= 3; k++) {
      const d = slopeAt({ mode: 'explicit', f: parse(expr) }, center, { order: k }).value;
      expect(Math.abs(c[k] * fact(k) - d)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(d)));
    }
  });
});

describe('taylorCoefficients: if()', () => {
  it.each<[string, number, number[]]>([
    ['if(x < 0, -x, x^2)', -2, [2, -1, 0]],
    ['if(x < 0, -x, x^2)', 1, [1, 2, 1]],
    ['if(x < 1, 2)', 0, [2, 0, 0]],
    ['if(0 < x < 2, exp(x), 0)', 1, [Math.E, Math.E, Math.E / 2]],
  ])('%s at %d takes the branch selected there', (expr, center, want) => {
    expectSeries(taylor(expr, center, 2), want);
  });

  it.each<[string, number]>([
    ['if(x < 0, -1, 1)', 0],
    ['if(x < 1, 2)', 1],
    // shortcut in taylor.ts: a removable boundary is NaN too.
    ['if(x != 0, sin(x)/x, 1)', 0],
  ])('%s on its boundary %d is NaN', (expr, center) => {
    expect(taylor(expr, center, 2).every(Number.isNaN)).toBe(true);
  });
});
