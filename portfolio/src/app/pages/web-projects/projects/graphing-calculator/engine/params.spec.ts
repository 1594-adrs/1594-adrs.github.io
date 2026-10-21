import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluator';
import {
  formatSliderValue,
  freeParams,
  rowFreeParams,
  sliderEnv,
  stepDecimals,
  substituteParams,
} from './params';
import { parse } from './parser';

describe('freeParams', () => {
  it('lists single-letter unbound names, sorted, without reserved ones', () => {
    expect(freeParams(parse('a*x^2 + b*sin(k*x) + e + pi + t'))).toEqual(['a', 'b', 'k']);
    expect(freeParams(parse('if(x < c, n, logb(2, x))'))).toEqual(['c', 'n']);
    expect(freeParams(parse('x^2'))).toEqual([]);
  });

  it('treats letter runs as one identifier (no param), as the parser does', () => {
    expect(freeParams(parse('ax'))).toEqual([]);
  });
});

describe('substituteParams', () => {
  it('replaces params by numbers so evaluation needs only x', () => {
    const ast = substituteParams(parse('a*x^2'), new Map([['a', 2]]));
    expect(evaluate(ast, { x: 3 })).toBe(18);
  });

  it('keeps negative values grouped: a^2 with a = -2 is 4', () => {
    const ast = substituteParams(parse('a^2'), new Map([['a', -2]]));
    expect(evaluate(ast, {})).toBe(4);
  });

  it('returns the same object when nothing is substituted', () => {
    const ast = parse('x^2 + 1');
    expect(substituteParams(ast, new Map([['a', 2]]))).toBe(ast);
  });
});

describe('rowFreeParams', () => {
  it('reads every piece of a row', () => {
    expect(rowFreeParams('y = a*x^2')).toEqual(['a']);
    expect(rowFreeParams('(a*cos(t), b*sin(t))')).toEqual(['a', 'b']);
    expect(rowFreeParams('c < x^2 + y^2 < d')).toEqual(['c', 'd']);
    expect(rowFreeParams('y = if(x < k, 1, 2)')).toEqual(['k']);
    expect(rowFreeParams('y = 2')).toEqual([]);
  });
});

describe('sliderEnv', () => {
  it('reads values, and a later duplicate is an error', () => {
    const env = sliderEnv(['a = 2', 'y = a*x', 'a = 3', 'b = 2a']);
    expect(env.values.get('a')).toBe(2);
    expect(env.rows[1]).toBeNull();
    expect(env.rows[2]?.error).toBe('a is already defined');
    expect(env.rows[3]?.error).toBe('Slider value must be a number');
    expect(env.claimed.has('b')).toBe(true);
    expect(env.values.has('b')).toBe(false);
  });
});

describe('formatSliderValue', () => {
  it('prints to the step precision without exponent or -0', () => {
    expect(stepDecimals(0.1)).toBe(1);
    expect(stepDecimals(0.25)).toBe(2);
    expect(formatSliderValue(2.04999, 0.1)).toBe('2');
    expect(formatSliderValue(-0.5, 0.1)).toBe('-0.5');
    expect(formatSliderValue(-0.01, 0.1)).toBe('0');
    expect(formatSliderValue(1e-7, 1e-7)).toBe('0.0000001');
  });
});
