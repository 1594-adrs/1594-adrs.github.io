import { describe, it, expect } from 'vitest';
import { compileExpression } from './evaluator';
import { parse, type ExpressionNode } from './parser';
import {
  countNodes,
  DifferentiationError,
  differentiate,
  substitute,
  toExpressionString,
} from './symbolic-diff';

const at = (n: ExpressionNode, x: number, y = NaN): number => compileExpression(n)(x, y);
const d = (s: string, v = 'x'): ExpressionNode => differentiate(parse(s), v);

/** Central difference of `s` at x (reference for the symbolic result). */
function numeric(s: string, x: number, h = 1e-5): number {
  const f = compileExpression(parse(s));
  return (f(x + h, NaN) - f(x - h, NaN)) / (2 * h);
}

describe('symbolic-diff', () => {
  it('d/dx x^x = x^x (ln x + 1)', () => {
    for (const x of [0.5, 1, 2.3]) {
      expect(at(d('x^x'), x)).toBeCloseTo(x ** x * (Math.log(x) + 1), 10);
    }
  });

  it('matches central differences on composite functions', () => {
    const cases = ['sin(x)^2*cos(3*x)', 'ln(x^2+1)/sqrt(x)', 'atan(e^x)', 'root(3, x)', '2^x*x^3'];
    for (const s of cases) {
      for (const x of [0.7, 1.9]) expect(at(d(s), x)).toBeCloseTo(numeric(s, x), 5);
    }
  });

  it('new functions: exact derivatives match central differences', () => {
    const cases: [string, number[]][] = [
      ['cbrt(x)', [0.7, 8, -3]],
      ['asinh(x)', [-1.2, 0.4]],
      ['acosh(x)', [1.5, 3]],
      ['atanh(x)', [-0.6, 0.3]],
      ['sech(x)', [-0.8, 1.4]],
      ['csch(x)', [0.5, -1.3]],
      ['coth(x)', [0.5, -1.3]],
      ['cbrt(x^2+1)*atanh(x/3)', [0.5, -1]],
    ];
    for (const [s, xs] of cases) {
      for (const x of xs) expect(at(d(s), x)).toBeCloseTo(numeric(s, x), 5);
    }
  });

  it('partial derivatives treat the other variable as a constant', () => {
    expect(at(d('x^2*y + sin(y)', 'y'), 2, 0)).toBeCloseTo(4 + 1, 12);
    expect(at(d('x^2*y + sin(y)', 'x'), 2, 3)).toBeCloseTo(12, 12);
  });

  it('toExpressionString round-trips through the parser', () => {
    const cases = ['x^x', 'sin(x)^2/(1 - x)', '-x^3 + 2*x - e^(-x)', 'ln(abs(x))*tan(x)'];
    for (const s of cases) {
      const ds = d(s);
      const back = parse(toExpressionString(ds));
      for (const x of [-0.8, 0.6, 1.7]) {
        const a = at(ds, x);
        if (Number.isFinite(a)) expect(at(back, x)).toBeCloseTo(a, 10);
      }
    }
  });

  it('substitute replaces a variable by an expression', () => {
    const n = substitute(parse('x^2 + y'), { y: parse('sin(x)') });
    expect(at(n, 0.4)).toBeCloseTo(0.16 + Math.sin(0.4), 12);
  });

  it('throws DifferentiationError for functions without a closed derivative', () => {
    expect(() => d('gamma(x)')).toThrow(DifferentiationError);
  });

  it('keeps repeated derivatives of exp(sin(x))/x bounded', () => {
    let n = parse('exp(sin(x))/x');
    const sizes: number[] = [];
    for (let k = 1; k <= 6; k++) {
      n = differentiate(n, 'x');
      sizes.push(countNodes(n));
    }
    expect(sizes[1]).toBeLessThanOrEqual(60);
    // Regression bound: minimal simplification grows ~4.5× per order (12049 at order 6).
    expect(sizes[5]).toBeLessThan(15000);
    // Order 6 against a central difference of the (exact) 4th derivative's second difference.
    const d4 = compileExpression(
      differentiate(
        differentiate(differentiate(differentiate(parse('exp(sin(x))/x'), 'x'), 'x'), 'x'),
        'x',
      ),
    );
    const h = 1e-3;
    const x = 1.3;
    const ref = (d4(x + h, NaN) - 2 * d4(x, NaN) + d4(x - h, NaN)) / (h * h);
    expect(at(n, x)).toBeCloseTo(ref, 3);
  });
});

describe('symbolic-diff: if()', () => {
  it('differentiates branch-wise', () => {
    const dd = d('if(x < 0, -x, x^2)');
    expect(at(dd, -1)).toBe(-1);
    expect(at(dd, 3)).toBe(6);
    expect(toExpressionString(dd)).toBe('if(x < 0, -1, 2*x)');
  });

  it('keeps the 2-arg form and folds constant branches to 0', () => {
    expect(at(d('if(x > 0, x^3)'), 2)).toBe(12);
    expect(at(d('if(x > 0, x^3)'), -2)).toBeNaN();
    expect(toExpressionString(d('if(x < 0, -1, if(x > 0, 1, 0))'))).toBe('0');
  });
});
