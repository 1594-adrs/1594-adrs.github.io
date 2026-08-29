import { describe, it, expect, afterEach } from 'vitest';
import { parse, clearAstCache } from './parser';
import { evaluate } from './evaluator';

afterEach(() => {
  clearAstCache();
});

describe('parser', () => {
  it('should parse a number', () => {
    const ast = parse('42');
    expect(ast.type).toBe('NumberLiteral');
    expect(evaluate(ast, {})).toBe(42);
  });

  it('should parse a decimal number', () => {
    const ast = parse('3.14');
    expect(evaluate(ast, {})).toBeCloseTo(3.14);
  });

  it('should parse a negative number', () => {
    const ast = parse('-5');
    expect(evaluate(ast, {})).toBe(-5);
  });

  it('should parse variable x', () => {
    const ast = parse('x');
    expect(ast.type).toBe('Variable');
    expect(evaluate(ast, { x: 7 })).toBe(7);
  });

  it('should parse constant e', () => {
    const ast = parse('e');
    expect(evaluate(ast, {})).toBeCloseTo(Math.E);
  });

  it('should parse constant pi', () => {
    const ast = parse('pi');
    expect(evaluate(ast, {})).toBeCloseTo(Math.PI);
  });

  it('should parse addition', () => {
    const ast = parse('2 + 3');
    expect(evaluate(ast, {})).toBe(5);
  });

  it('should parse subtraction', () => {
    const ast = parse('10 - 4');
    expect(evaluate(ast, {})).toBe(6);
  });

  it('should parse multiplication', () => {
    const ast = parse('3 * 7');
    expect(evaluate(ast, {})).toBe(21);
  });

  it('should parse division', () => {
    const ast = parse('15 / 3');
    expect(evaluate(ast, {})).toBe(5);
  });

  it('should parse power', () => {
    const ast = parse('2 ^ 3');
    expect(evaluate(ast, {})).toBe(8);
  });

  it('should respect operator precedence', () => {
    const ast = parse('2 + 3 * 4');
    expect(evaluate(ast, {})).toBe(14);
  });

  it('should parse parenthesized expression', () => {
    const ast = parse('(2 + 3) * 4');
    expect(evaluate(ast, {})).toBe(20);
  });

  it('should parse sin function', () => {
    const ast = parse('sin(0)');
    expect(evaluate(ast, {})).toBeCloseTo(0);
  });

  it('should parse cos function', () => {
    const ast = parse('cos(0)');
    expect(evaluate(ast, {})).toBeCloseTo(1);
  });

  it('should parse sqrt function', () => {
    const ast = parse('sqrt(9)');
    expect(evaluate(ast, {})).toBeCloseTo(3);
  });

  it('should parse ln function', () => {
    const ast = parse('ln(1)');
    expect(evaluate(ast, {})).toBeCloseTo(0);
  });

  it('should parse nested function: sin(x^2)', () => {
    const ast = parse('sin(x ^ 2)');
    expect(evaluate(ast, { x: 0 })).toBeCloseTo(0);
  });

  it('should parse expression: e^(-x)', () => {
    const ast = parse('e ^ (-x)');
    expect(evaluate(ast, { x: 0 })).toBeCloseTo(1);
  });

  it('should parse complex expression: sin(x) * e^(-x/5)', () => {
    const ast = parse('sin(x) * e ^ (-x / 5)');
    expect(evaluate(ast, { x: 0 })).toBeCloseTo(0);
  });

  it('should throw on unclosed parenthesis', () => {
    expect(() => parse('sin(')).toThrow();
  });

  it('should parse x ++ 1 as x + (+1)', () => {
    const ast = parse('x ++ 1');
    expect(evaluate(ast, { x: 5 })).toBe(6);
  });

  it('should parse x * 2 as multiplication', () => {
    const ast = parse('x * 2');
    expect(evaluate(ast, { x: 5 })).toBe(10);
  });

  it('should parse expression with spaces', () => {
    const ast = parse('  2  +  3  ');
    expect(evaluate(ast, {})).toBe(5);
  });

  it('should cache AST for the same expression', () => {
    const first = parse('sin(x)');
    const second = parse('sin(x)');
    expect(first).toBe(second);
  });

  it('should return different ASTs for different expressions', () => {
    const a = parse('sin(x)');
    const b = parse('cos(x)');
    expect(a).not.toBe(b);
  });

  describe('new functions', () => {
    it('should parse sec(x)', () => {
      const ast = parse('sec(x)');
      expect(ast.type).toBe('FunctionCall');
    });

    it('should parse asin(x)', () => {
      const ast = parse('asin(x)');
      expect(ast.type).toBe('FunctionCall');
    });

    it('should parse sinh(x)', () => {
      const ast = parse('sinh(x)');
      expect(ast.type).toBe('FunctionCall');
    });

    it('should parse floor(x)', () => {
      const ast = parse('floor(x)');
      expect(ast.type).toBe('FunctionCall');
    });

    it('should parse min(x, 1)', () => {
      const ast = parse('min(x, 1)');
      expect(ast.type).toBe('FunctionCallMultiArg');
    });

    it('should parse max(x, 0)', () => {
      const ast = parse('max(x, 0)');
      expect(ast.type).toBe('FunctionCallMultiArg');
    });

    it('should parse mod(x, 2)', () => {
      const ast = parse('mod(x, 2)');
      expect(ast.type).toBe('FunctionCallMultiArg');
    });
  });

  describe('error cases', () => {
    it('empty expression should throw', () => {
      expect(() => parse('')).toThrow();
    });

    it('whitespace-only expression should throw', () => {
      expect(() => parse('   ')).toThrow();
    });

    it('invalid character @ should throw', () => {
      expect(() => parse('3 @ 2')).toThrow();
    });

    it('invalid character $ should throw', () => {
      expect(() => parse('$')).toThrow();
    });

    it('trailing tokens should throw', () => {
      expect(() => parse('1 2')).toThrow();
    });

    it('trailing operator should throw', () => {
      expect(() => parse('1 +')).toThrow();
    });
  });

  describe('unknown functions treated as variables', () => {
    it('foo(x) should parse as foo * x with implicit multiplication', () => {
      const ast = parse('foo(x)');
      expect(evaluate(ast, { foo: 3, x: 4 })).toBe(12);
    });

    it('unknown identifier alone is parsed as variable', () => {
      const ast = parse('bar');
      expect(ast.type).toBe('Variable');
    });
  });

  describe('valid expressions', () => {
    it('number literal', () => {
      const ast = parse('42');
      expect(ast.type).toBe('NumberLiteral');
      expect(evaluate(ast, {})).toBe(42);
    });

    it('variable', () => {
      const ast = parse('x');
      expect(ast.type).toBe('Variable');
      expect(evaluate(ast, { x: 7 })).toBe(7);
    });

    it('binary addition', () => {
      const ast = parse('1+2');
      expect(ast.type).toBe('BinaryOp');
      expect(evaluate(ast, {})).toBe(3);
    });

    it('binary multiplication', () => {
      const ast = parse('3*4');
      expect(ast.type).toBe('BinaryOp');
      expect(evaluate(ast, {})).toBe(12);
    });

    it('function call', () => {
      const ast = parse('sin(x)');
      expect(ast.type).toBe('FunctionCall');
      expect(evaluate(ast, { x: 0 })).toBeCloseTo(0);
    });
  });

  describe('nested functions', () => {
    it('sin(cos(x))', () => {
      const ast = parse('sin(cos(x))');
      expect(ast.type).toBe('FunctionCall');
      expect(evaluate(ast, { x: 0 })).toBeCloseTo(Math.sin(1), 10);
    });

    it('sqrt(abs(-5))', () => {
      const ast = parse('sqrt(abs(-5))');
      expect(evaluate(ast, {})).toBeCloseTo(Math.sqrt(5), 10);
    });

    it('ln(exp(1))', () => {
      const ast = parse('ln(exp(1))');
      expect(evaluate(ast, {})).toBeCloseTo(1, 10);
    });
  });

  describe('multi-arg functions', () => {
    it('min(1,2) should return 1', () => {
      const ast = parse('min(1,2)');
      expect(ast.type).toBe('FunctionCallMultiArg');
      expect(evaluate(ast, {})).toBe(1);
    });

    it('max(3,4) should return 4', () => {
      const ast = parse('max(3,4)');
      expect(ast.type).toBe('FunctionCallMultiArg');
      expect(evaluate(ast, {})).toBe(4);
    });

    it('min(5,2,8) should return 2', () => {
      const ast = parse('min(5,2,8)');
      expect(ast.type).toBe('FunctionCallMultiArg');
      expect(evaluate(ast, {})).toBe(2);
    });

    it('max(1,9,3) should return 9', () => {
      const ast = parse('max(1,9,3)');
      expect(ast.type).toBe('FunctionCallMultiArg');
      expect(evaluate(ast, {})).toBe(9);
    });
  });

  describe('implicit multiplication', () => {
    it('2x should parse as 2*x', () => {
      const ast = parse('2x');
      expect(evaluate(ast, { x: 5 })).toBe(10);
    });

    it('x(x+1) should parse as x*(x+1)', () => {
      const ast = parse('x(x+1)');
      expect(evaluate(ast, { x: 3 })).toBe(12);
    });

    it('(2)(3) should parse as (2)*(3)', () => {
      const ast = parse('(2)(3)');
      expect(evaluate(ast, {})).toBe(6);
    });

    it('2sin(x) should parse as 2*sin(x)', () => {
      const ast = parse('2sin(x)');
      expect(evaluate(ast, { x: 0 })).toBeCloseTo(0);
      expect(evaluate(ast, { x: Math.PI / 2 })).toBeCloseTo(2);
    });

    it('x pi should parse as x*pi', () => {
      const ast = parse('x pi');
      expect(evaluate(ast, { x: 2 })).toBeCloseTo(2 * Math.PI);
    });

    it('2^x should NOT insert implicit multiply', () => {
      const ast = parse('2^x');
      expect(evaluate(ast, { x: 3 })).toBe(8);
    });
  });

  describe('chained powers (right-associative)', () => {
    it('2^3^2 should be 2^(3^2) = 512', () => {
      const ast = parse('2^3^2');
      expect(evaluate(ast, {})).toBe(512);
    });

    it('3^2^3 should be 3^(2^3) = 6561', () => {
      const ast = parse('3^2^3');
      expect(evaluate(ast, {})).toBe(6561);
    });
  });

  describe('comparison operators', () => {
    it('3 > 2 should be 1', () => {
      const ast = parse('3 > 2');
      expect(evaluate(ast, {})).toBe(1);
    });

    it('1 > 2 should be 0', () => {
      const ast = parse('1 > 2');
      expect(evaluate(ast, {})).toBe(0);
    });

    it('x <= 5 with x=3 should be 1', () => {
      const ast = parse('x <= 5');
      expect(evaluate(ast, { x: 3 })).toBe(1);
    });

    it('x == 5 with x=5 should be 1', () => {
      const ast = parse('x == 5');
      expect(evaluate(ast, { x: 5 })).toBe(1);
    });

    it('x != 5 with x=3 should be 1', () => {
      const ast = parse('x != 5');
      expect(evaluate(ast, { x: 3 })).toBe(1);
    });
  });

  describe('complexity limit', () => {
    it('should throw on expression exceeding 500 nodes', () => {
      const expr = Array(251).fill('1+').join('') + '1';
      expect(() => parse(expr)).toThrow('Expression too complex');
    });
  });
});
