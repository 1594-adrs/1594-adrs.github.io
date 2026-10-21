import { describe, it, expect } from 'vitest';
import { compileExpression, evalConstantExpression, evalExpression, evaluate } from './evaluator';
import { parse, type ExpressionNode, type PoweredFunctionCall } from './parser';

describe('evalConstantExpression', () => {
  it('should evaluate pi', () => {
    expect(evalConstantExpression('pi')).toBeCloseTo(Math.PI, 10);
  });

  it('should evaluate π', () => {
    expect(evalConstantExpression('π')).toBeCloseTo(Math.PI, 10);
  });

  it('should evaluate e', () => {
    expect(evalConstantExpression('e')).toBeCloseTo(Math.E, 10);
  });

  it('should evaluate 2*pi', () => {
    expect(evalConstantExpression('2*pi')).toBeCloseTo(2 * Math.PI, 10);
  });

  it('should evaluate e/2', () => {
    expect(evalConstantExpression('e/2')).toBeCloseTo(Math.E / 2, 10);
  });

  it('should evaluate sqrt(2)', () => {
    expect(evalConstantExpression('sqrt(2)')).toBeCloseTo(Math.SQRT2, 10);
  });

  it('should evaluate pi/2', () => {
    expect(evalConstantExpression('pi/2')).toBeCloseTo(Math.PI / 2, 10);
  });

  it('should evaluate 2+3', () => {
    expect(evalConstantExpression('2+3')).toBe(5);
  });

  it('should evaluate -(pi)', () => {
    expect(evalConstantExpression('-(pi)')).toBeCloseTo(-Math.PI, 10);
  });

  it('should throw on empty expression', () => {
    expect(() => evalConstantExpression('')).toThrow();
  });

  it('should throw on expression with x variable', () => {
    expect(() => evalConstantExpression('x')).toThrow();
  });

  it('should throw on expression with unknown variable', () => {
    expect(() => evalConstantExpression('foo')).toThrow();
  });

  it('should throw on Object.prototype property names used as variables', () => {
    expect(() => evalConstantExpression('constructor')).toThrow();
    expect(() => evalConstantExpression('toString')).toThrow();
  });

  it('should evaluate abs(-3)', () => {
    expect(evalConstantExpression('abs(-3)')).toBe(3);
  });

  it('should evaluate exp(1)', () => {
    expect(evalConstantExpression('exp(1)')).toBeCloseTo(Math.E, 10);
  });

  it('should evaluate ln(e)', () => {
    expect(evalConstantExpression('ln(e)')).toBeCloseTo(1, 10);
  });

  it('should evaluate log(100)', () => {
    expect(evalConstantExpression('log(100)')).toBeCloseTo(2, 10);
  });

  describe('new functions', () => {
    it('sec(0) = 1', () => {
      expect(evalExpression('sec(0)', 0)).toBeCloseTo(1, 10);
    });

    it('csc(pi/2) = 1', () => {
      expect(evalExpression('csc(pi/2)', 0)).toBeCloseTo(1, 10);
    });

    it('cot(pi/4) = 1', () => {
      expect(evalExpression('cot(pi/4)', 0)).toBeCloseTo(1, 10);
    });

    it('asin(1) = pi/2', () => {
      expect(evalExpression('asin(1)', 0)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('acos(1) = 0', () => {
      expect(evalExpression('acos(1)', 0)).toBeCloseTo(0, 10);
    });

    it('atan(1) = pi/4', () => {
      expect(evalExpression('atan(1)', 0)).toBeCloseTo(Math.PI / 4, 10);
    });

    it('sinh(0) = 0', () => {
      expect(evalExpression('sinh(0)', 0)).toBeCloseTo(0, 10);
    });

    it('cosh(0) = 1', () => {
      expect(evalExpression('cosh(0)', 0)).toBeCloseTo(1, 10);
    });

    it('tanh(0) = 0', () => {
      expect(evalExpression('tanh(0)', 0)).toBeCloseTo(0, 10);
    });

    it('cbrt is the real cube root', () => {
      expect(evalExpression('cbrt(27)', 0)).toBeCloseTo(3, 12);
      expect(evalExpression('cbrt(-8)', 0)).toBeCloseTo(-2, 12);
    });

    it('inverse hyperbolics, with NaN outside the domain', () => {
      expect(evalExpression('asinh(1)', 0)).toBeCloseTo(Math.asinh(1), 12);
      expect(evalExpression('acosh(2)', 0)).toBeCloseTo(Math.acosh(2), 12);
      expect(evalExpression('atanh(0.5)', 0)).toBeCloseTo(Math.atanh(0.5), 12);
      expect(evalExpression('acosh(0.5)', 0)).toBeNaN();
      expect(evalExpression('atanh(1)', 0)).toBeNaN();
      expect(evalExpression('atanh(-2)', 0)).toBeNaN();
    });

    it('sech, csch, coth are reciprocals of cosh, sinh, tanh', () => {
      expect(evalExpression('sech(1)', 0)).toBeCloseTo(1 / Math.cosh(1), 12);
      expect(evalExpression('csch(1)', 0)).toBeCloseTo(1 / Math.sinh(1), 12);
      expect(evalExpression('coth(1)', 0)).toBeCloseTo(1 / Math.tanh(1), 12);
    });

    it('floor(1.5) = 1', () => {
      expect(evalExpression('floor(1.5)', 0)).toBe(1);
    });

    it('ceil(1.5) = 2', () => {
      expect(evalExpression('ceil(1.5)', 0)).toBe(2);
    });

    it('round(1.4) = 1', () => {
      expect(evalExpression('round(1.4)', 0)).toBe(1);
    });

    it('sign(5) = 1', () => {
      expect(evalExpression('sign(5)', 0)).toBe(1);
    });

    it('min(3, 1) = 1', () => {
      expect(evalExpression('min(3, 1)', 0)).toBe(1);
    });

    it('max(3, 1) = 3', () => {
      expect(evalExpression('max(3, 1)', 0)).toBe(3);
    });

    it('mod(5, 3) = 2', () => {
      expect(evalExpression('mod(5, 3)', 0)).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('1/0 should return Infinity', () => {
      expect(evalExpression('1/0', 0)).toBe(Infinity);
    });

    it('0/0 should return NaN', () => {
      expect(evalExpression('0/0', 0)).toBeNaN();
    });

    it('sqrt(-1) should return NaN', () => {
      expect(evalExpression('sqrt(-1)', 0)).toBeNaN();
    });

    it('asin(2) should return NaN', () => {
      expect(evalExpression('asin(2)', 0)).toBeNaN();
    });

    it('ln(-1) should return NaN', () => {
      expect(evalExpression('ln(-1)', 0)).toBeNaN();
    });

    it('log(0) should return -Infinity', () => {
      expect(evalExpression('log(0)', 0)).toBe(-Infinity);
    });

    it('sec(pi/2) should be Infinity or very large', () => {
      const result = evalExpression('sec(pi/2)', 0);
      expect(Math.abs(result)).toBeGreaterThan(1e10);
    });

    it('csc(0) should be Infinity or very large', () => {
      const result = evalExpression('csc(0)', 0);
      expect(Math.abs(result)).toBeGreaterThan(1e10);
    });

    it('evalExpression with y parameter', () => {
      expect(evalExpression('x + y', 3, 4)).toBe(7);
      expect(evalExpression('x * y', 2, 5)).toBe(10);
    });

    it('evalExpression without y parameter', () => {
      expect(evalExpression('x', 5)).toBe(5);
    });

    it('sin(pi) should be close to 0', () => {
      expect(evalExpression('sin(pi)', 0)).toBeCloseTo(0, 10);
    });

    it('cos(0) should be 1', () => {
      expect(evalExpression('cos(0)', 0)).toBeCloseTo(1, 10);
    });

    it('tan(pi/4) should be close to 1', () => {
      expect(evalExpression('tan(pi/4)', 0)).toBeCloseTo(1, 10);
    });

    it('power: 2^10 should be 1024', () => {
      expect(evalExpression('2^10', 0)).toBe(1024);
    });
  });

  describe('angle unit support', () => {
    it('sin(90) in deg mode should be 1', () => {
      expect(evalExpression('sin(90)', 0, undefined, 'deg')).toBeCloseTo(1, 10);
    });

    it('sin(pi/2) in rad mode should be 1', () => {
      expect(evalExpression('sin(pi/2)', 0, undefined, 'rad')).toBeCloseTo(1, 10);
    });

    it('cos(0) in deg mode should be 1', () => {
      expect(evalExpression('cos(0)', 0, undefined, 'deg')).toBeCloseTo(1, 10);
    });

    it('asin(1) in deg mode should return 90', () => {
      expect(evalExpression('asin(1)', 0, undefined, 'deg')).toBeCloseTo(90, 10);
    });
  });

  describe('mathematical mod', () => {
    it('mod(-3, 7) should be 4', () => {
      expect(evalExpression('mod(-3, 7)', 0)).toBe(4);
    });

    it('mod(-1, 3) should be 2', () => {
      expect(evalExpression('mod(-1, 3)', 0)).toBe(2);
    });

    it('mod(5, 3) should be 2', () => {
      expect(evalExpression('mod(5, 3)', 0)).toBe(2);
    });
  });

  describe('new functions', () => {
    it('factorial(0) = 1', () => {
      expect(evalExpression('factorial(0)', 0)).toBe(1);
    });

    it('factorial(5) = 120', () => {
      expect(evalExpression('factorial(5)', 0)).toBe(120);
    });

    it('ncr(5,2) = 10', () => {
      expect(evalExpression('ncr(5, 2)', 0)).toBe(10);
    });

    it('npr(5,2) = 20', () => {
      expect(evalExpression('npr(5, 2)', 0)).toBe(20);
    });

    it('logb(2, 8) = 3', () => {
      expect(evalExpression('logb(2, 8)', 0)).toBeCloseTo(3, 10);
    });

    it('root(3, 27) = 3', () => {
      expect(evalExpression('root(3, 27)', 0)).toBeCloseTo(3, 10);
    });
  });

  describe('comparisons', () => {
    it('evaluate(3 > 2) = 1', () => {
      expect(evalExpression('3 > 2', 0)).toBe(1);
    });

    it('evaluate(1 > 2) = 0', () => {
      expect(evalExpression('1 > 2', 0)).toBe(0);
    });

    it('evaluate(5 == 5) = 1', () => {
      expect(evalExpression('5 == 5', 0)).toBe(1);
    });

    it('evaluate(5 != 5) = 0', () => {
      expect(evalExpression('5 != 5', 0)).toBe(0);
    });
  });

  describe('real roots of negative bases', () => {
    it('(-8)^(1/3) = -2', () => {
      expect(evalExpression('(-8)^(1/3)', 0)).toBeCloseTo(-2, 9);
    });

    it('x^(1/3) at x=-8 = -2', () => {
      expect(evalExpression('x^(1/3)', -8)).toBeCloseTo(-2, 9);
    });

    it('x^(2/3) at x=-8 = 4', () => {
      expect(evalExpression('x^(2/3)', -8)).toBeCloseTo(4, 9);
    });

    it('(-8)^(1/2) is NaN (even denominator, no real root)', () => {
      expect(evalExpression('(-8)^(1/2)', 0)).toBeNaN();
    });

    it('root(3, -27) = -3', () => {
      expect(evalExpression('root(3, -27)', 0)).toBeCloseTo(-3, 9);
    });

    it('(-2)^0.5 is NaN', () => {
      expect(evalExpression('(-2)^0.5', 0)).toBeNaN();
    });

    // Built by hand (not via `parse`) because the outer '^' power and the
    // function's own arg-parens are adjacent text ('...)(...)'), which the
    // lexer's implicit-multiplication pass also treats as `)*( ` — a
    // separate, pre-existing tokenization quirk unrelated to this fix.
    function poweredCall(name: string, powerExpr: string): PoweredFunctionCall {
      return {
        type: 'PoweredFunctionCall',
        name,
        arg: { type: 'Variable', name: 'pi' },
        power: parse(powerExpr),
      };
    }

    it('cos^(1/3)(pi) = -1 (PoweredFunctionCall outer power uses the real odd root, like ^)', () => {
      const ast = poweredCall('cos', '1/3');
      expect(evaluate(ast, {})).toBeCloseTo(-1, 9);
    });

    it('cos^(1/2)(pi) is NaN (even denominator, no real root, like ^)', () => {
      const ast = poweredCall('cos', '1/2');
      expect(evaluate(ast, {})).toBeNaN();
    });
  });

  describe('scientific notation', () => {
    it('1E-3 = 0.001', () => {
      expect(evalConstantExpression('1E-3')).toBeCloseTo(0.001, 12);
    });

    it('2.5E4 = 25000', () => {
      expect(evalConstantExpression('2.5E4')).toBe(25000);
    });

    it('1E+2 = 100', () => {
      expect(evalConstantExpression('1E+2')).toBe(100);
    });

    it('.5E1 = 5', () => {
      expect(evalConstantExpression('.5E1')).toBe(5);
    });

    it('lowercase e still means Euler constant: 2e-3 = 2*e - 3', () => {
      expect(evalConstantExpression('2e-3')).toBeCloseTo(2 * Math.E - 3, 10);
    });
  });
});

describe('compileExpression', () => {
  /** Table of (expr, x, y) samples whose compiled result must match evalExpression's,
   *  in both angle units, across the domain-error / division-by-zero / real-odd-root cases. */
  const cases: Array<{ expr: string; x: number; y?: number }> = [
    { expr: 'x + y', x: 3, y: 4 },
    { expr: 'x * y - 2', x: 2, y: 5 },
    { expr: 'x^2 + y^2 - 1', x: 0.6, y: 0.8 },
    { expr: 'sin(x)', x: Math.PI / 2 },
    { expr: 'cos(x) + tan(x)', x: 1.2 },
    { expr: 'sqrt(-1)', x: 0 },
    { expr: '(-8)^(1/3)', x: 0 },
    { expr: 'x^(1/3)', x: -8 },
    { expr: 'x^(2/3)', x: -8 },
    { expr: 'root(3, -27)', x: 0 },
    { expr: '1/0', x: 0 },
    { expr: '0/0', x: 0 },
    { expr: 'ln(-1)', x: 0 },
    { expr: 'log(0)', x: 0 },
    { expr: 'sec(pi/2)', x: 0 },
    { expr: 'min(x, y)', x: 3, y: 1 },
    { expr: 'mod(x, 3)', x: -1 },
    { expr: 'logb(2, x)', x: 8 },
    { expr: 'ncr(5, 2)', x: 0 },
    { expr: 'factorial(x)', x: 5 },
    { expr: 'asin(x)', x: 2 },
    { expr: 'cos(x)^(1/3)', x: Math.PI },
  ];

  for (const angleUnit of ['rad', 'deg'] as const) {
    describe(`parity with evalExpression (${angleUnit})`, () => {
      for (const { expr, x, y } of cases) {
        it(`${expr} at x=${x}${y !== undefined ? `, y=${y}` : ''}`, () => {
          const ast = parse(expr);
          const compiled = compileExpression(ast, angleUnit);
          const expected = evalExpression(ast, x, y, angleUnit);
          const actual = compiled(x, y ?? 0);
          if (Number.isNaN(expected)) {
            expect(actual).toBeNaN();
          } else {
            expect(actual).toBe(expected);
          }
        });
      }
    });
  }

  it('caches the compiled function per (ast, angleUnit)', () => {
    const ast = parse('x^2 + 1');
    const a = compileExpression(ast, 'rad');
    const b = compileExpression(ast, 'rad');
    const c = compileExpression(ast, 'deg');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('maps t the same as x (parametric curves bind both to the same value)', () => {
    const ast = parse('t^2');
    const compiled = compileExpression(ast, 'rad');
    expect(compiled(3, 0)).toBe(9);
  });

  it('trig respects angle unit like evalExpression', () => {
    const ast = parse('sin(x)');
    const rad = compileExpression(ast, 'rad');
    const deg = compileExpression(ast, 'deg');
    expect(rad(Math.PI / 2, 0)).toBeCloseTo(1, 10);
    expect(deg(90, 0)).toBeCloseTo(1, 10);
  });
});

describe('evaluator wave-1 regressions (H24)', () => {
  const deg = (src: string, x = 0): number => evalExpression(src, x, undefined, 'deg');
  const degCompiled = (src: string, x = 0): number => compileExpression(parse(src), 'deg')(x, 0);

  it('degrees: cos(90) is exactly 0 and sin(180) is exactly 0 (interpreted and compiled)', () => {
    for (const run of [deg, degCompiled]) {
      expect(run('cos(90)')).toBe(0);
      expect(run('sin(180)')).toBe(0);
      expect(run('sin(90)')).toBe(1);
      expect(run('cos(180)')).toBe(-1);
      expect(run('sin(270)')).toBe(-1);
      expect(run('cos(360)')).toBe(1);
    }
  });

  it('degrees: tan(90) is undefined instead of 1.6e16, tan(180) is 0', () => {
    for (const run of [deg, degCompiled]) {
      expect(run('tan(90)')).toBeNaN();
      expect(run('tan(270)')).toBeNaN();
      expect(run('tan(-90)')).toBeNaN();
      expect(run('tan(180)')).toBe(0);
      expect(run('tan(45)')).toBeCloseTo(1, 12);
    }
  });

  it('degrees: reduces mod 360 so large and negative angles stay accurate', () => {
    expect(deg('sin(36030)')).toBeCloseTo(0.5, 12); // 36030 = 100*360 + 30
    expect(deg('cos(-60)')).toBeCloseTo(0.5, 12);
    expect(deg('sin(-30)')).toBeCloseTo(-0.5, 12);
  });

  it('degrees: sec/csc/cot at multiples of 90', () => {
    expect(deg('cot(90)')).toBe(0);
    expect(deg('sec(0)')).toBe(1);
    expect(deg('csc(0)')).toBe(Infinity);
    expect(deg('cot(0)')).toBe(Infinity);
  });

  it('degrees: powered trig uses the exact variant too', () => {
    expect(deg('cos^2(90)')).toBe(0);
    expect(deg('sin^2(90)')).toBe(1);
  });

  it('radians are unchanged', () => {
    expect(evalExpression('sin(pi)', 0)).toBeCloseTo(0, 12);
    expect(evalExpression('sin(pi)', 0)).not.toBe(0);
    expect(evalExpression('cos(0)', 0)).toBe(1);
  });

  it('ncr(200,2) = 19900, ncr(52,5) = 2598960, ncr(5,0) = 1, ncr(5,5) = 1', () => {
    expect(evalExpression('ncr(200,2)', 0)).toBe(19900);
    expect(evalExpression('ncr(52,5)', 0)).toBe(2598960);
    expect(evalExpression('ncr(5,0)', 0)).toBe(1);
    expect(evalExpression('ncr(5,5)', 0)).toBe(1);
    expect(evalExpression('ncr(100,50)', 0)).toBeCloseTo(1.0089134454556419e29, -15);
  });

  it('ncr/npr reject invalid arguments and overflow to Infinity quickly', () => {
    expect(evalExpression('ncr(5,6)', 0)).toBeNaN();
    expect(evalExpression('ncr(-1,0)', 0)).toBeNaN();
    expect(evalExpression('ncr(5.5,2)', 0)).toBeNaN();
    expect(evalExpression('ncr(5,-1)', 0)).toBeNaN();
    const t = performance.now();
    expect(evalExpression('ncr(1000000000000,500000000000)', 0)).toBe(Infinity);
    expect(performance.now() - t).toBeLessThan(100);
  });

  it('npr(200,2) = 39800, npr(5,2) = 20, npr(5,0) = 1', () => {
    expect(evalExpression('npr(200,2)', 0)).toBe(39800);
    expect(evalExpression('npr(5,2)', 0)).toBe(20);
    expect(evalExpression('npr(5,0)', 0)).toBe(1);
    expect(evalExpression('npr(3,4)', 0)).toBeNaN();
  });

  it('gamma at non-positive integers is NaN; elsewhere unchanged', () => {
    expect(evalExpression('gamma(0)', 0)).toBeNaN();
    expect(evalExpression('gamma(-1)', 0)).toBeNaN();
    expect(evalExpression('gamma(-7)', 0)).toBeNaN();
    expect(evalExpression('gamma(5)', 0)).toBeCloseTo(24, 9);
    expect(evalExpression('gamma(0.5)', 0)).toBeCloseTo(Math.sqrt(Math.PI), 9);
    expect(evalExpression('gamma(-0.5)', 0)).toBeCloseTo(-2 * Math.sqrt(Math.PI), 9);
  });
});

describe('if() and comparisons', () => {
  const both = (s: string, x: number): [number, number] => [
    evaluate(parse(s), { x, y: 0, t: x }),
    compileExpression(parse(s))(x, 0),
  ];

  it.each<[string, number, number]>([
    ['if(x < 0, -1, 1)', -2, -1],
    ['if(x < 0, -1, 1)', 0, 1],
    ['if(x, 2, 3)', 0.5, 2],
    ['if(x < 0, -1)', 2, NaN],
    ['if(sqrt(x) < 1, 1, 2)', -1, NaN],
    ['if(x > 0, ln(x), 0)', -1, 0],
    ['if(x < 0, -x, if(x < 1, x^2, 1))', 0.5, 0.25],
    ['sqrt(x) < 1', -1, NaN],
    ['x == 2', 2, 1],
    ['x != 2', 2, 0],
  ])('%s at %d = %d (evaluate and compiled)', (s, x, want) => {
    expect(both(s, x)).toEqual([want, want]);
  });

  it('only the selected branch is evaluated', () => {
    expect(evaluate(parse('if(x < 0, 1, foo)'), { x: -1 })).toBe(1);
    expect(compileExpression(parse('if(x < 0, 1, foo)'))(-1, 0)).toBe(1);
    expect(() => evaluate(parse('if(x < 0, 1, foo)'), { x: 1 })).toThrow(/foo/);
    expect(() => compileExpression(parse('if(x < 0, 1, foo)'))(1, 0)).toThrow(/foo/);
  });
});

describe('compileExpression parity', () => {
  const UNARY = [
    'sin',
    'cos',
    'tan',
    'sec',
    'csc',
    'cot',
    'asin',
    'acos',
    'atan',
    'sinh',
    'cosh',
    'tanh',
    'cbrt',
    'asinh',
    'acosh',
    'atanh',
    'sech',
    'csch',
    'coth',
    'log',
    'ln',
    'sqrt',
    'abs',
    'exp',
    'floor',
    'ceil',
    'round',
    'sign',
    'factorial',
    'gamma',
  ];
  const exprs = [
    ...UNARY.map((f) => `${f}(x)`),
    ...UNARY.map((f) => `${f}^2(x)`),
    'asin^(1/3)(x)',
    'min(x, y, 1)',
    'max(x, y)',
    'mod(x, y)',
    'logb(y, x)',
    'root(3, x)',
    'atan2(y, x)',
    'npr(x, 2)',
    'ncr(x, 2)',
    'x^(1/3)',
    'x^(2/3)',
    'x^y',
    '-x^2',
    '(-x)^3',
    'x^-1',
    '2^x',
    'e^x + pi - π',
    '1 < x < 3',
    'x <= y > 0',
    'x >= 1',
    'x == y',
    'x != y',
    '(x < 1) < 1',
    'if(x < 0, -x)',
    'if(x, y)',
    'if(x > y, ln(x), sqrt(y))',
    'if(x<0, x^2, sqrt(x))+tan(x)',
    '0/0 + x',
    '1/x',
    '1e-7*x',
    '2.5E3 - x',
  ];
  const xs = [-8, -2.5, -1, -0.5, 0, 0.3, 1, 2, 5, 90, 180, NaN, Infinity, -Infinity];
  const ys = [-3, 0, 2, NaN];

  for (const angleUnit of ['rad', 'deg'] as const) {
    it(`matches evaluate() bit for bit on every function and operator (${angleUnit})`, () => {
      const mismatches: string[] = [];
      for (const src of exprs) {
        const ast = parse(src);
        const fn = compileExpression(ast, angleUnit);
        for (const x of xs) {
          for (const y of ys) {
            const want = evaluate(ast, { x, y, t: x }, angleUnit);
            const got = fn(x, y);
            if (!Object.is(want, got)) mismatches.push(`${src} @(${x},${y}): ${want} vs ${got}`);
          }
        }
      }
      expect(mismatches).toEqual([]);
    });
  }

  it('substituted slider values (negative, -0, NaN, Infinity literals) compile to the same numbers', () => {
    for (const value of [-2, -0, 1e-300, -1.5e21, NaN, Infinity, -Infinity]) {
      const ast = {
        type: 'BinaryOp',
        operator: '-',
        left: { type: 'Variable', name: 'x' },
        right: { type: 'NumberLiteral', value },
      } as const;
      expect(compileExpression(ast)(1, 0)).toBe(1 - value);
      expect(Object.is(compileExpression({ type: 'NumberLiteral', value })(0, 0), value)).toBe(
        true,
      );
    }
  });

  // f'' of a 250-factor product (the deepest tree the parser + symbolic-diff produce) is ~750 deep.
  it('compiles 1000-deep trees (symbolic derivatives exceed MAX_AST_NODES) without a stack overflow', () => {
    let deep: ExpressionNode = { type: 'Variable', name: 'x' };
    for (let i = 0; i < 1000; i++) {
      deep = {
        type: 'BinaryOp',
        operator: '+',
        left: deep,
        right: { type: 'NumberLiteral', value: 1 },
      };
    }
    expect(compileExpression(deep)(1, 0)).toBe(1001);
    const long = Array.from({ length: 160 }, () => 'x').join('+');
    expect(compileExpression(parse(long))(1, 0)).toBe(160);
  });
});
