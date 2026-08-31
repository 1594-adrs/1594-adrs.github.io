import { describe, it, expect } from 'vitest';
import { evalConstantExpression, evalExpression } from './evaluator';

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
});
