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
});
