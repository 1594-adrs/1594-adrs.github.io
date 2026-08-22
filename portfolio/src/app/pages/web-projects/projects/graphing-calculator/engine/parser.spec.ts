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
});
