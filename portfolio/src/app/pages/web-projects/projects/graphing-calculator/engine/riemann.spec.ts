import { describe, expect, it } from 'vitest';
import { riemannSum } from './riemann';

const sq = (x: number) => x * x;

describe('riemannSum', () => {
  it('left / right / mid / trap / simpson of x^2 on [0, 2], n = 4', () => {
    expect(riemannSum(sq, 0, 2, 4, 'left').value).toBeCloseTo(1.75, 12);
    expect(riemannSum(sq, 0, 2, 4, 'right').value).toBeCloseTo(3.75, 12);
    expect(riemannSum(sq, 0, 2, 4, 'mid').value).toBeCloseTo(2.625, 12);
    expect(riemannSum(sq, 0, 2, 4, 'trap').value).toBeCloseTo(2.75, 12);
    expect(riemannSum(sq, 0, 2, 4, 'simpson').value).toBeCloseTo(8 / 3, 12);
  });

  it('returns the panels to draw, with the samples of each rule', () => {
    const left = riemannSum(sq, 0, 2, 4, 'left');
    expect(left.panels).toHaveLength(4);
    expect(left.panels[1]).toEqual({ a: 0.5, b: 1, xs: [0.5], ys: [0.25] });
    expect(riemannSum(sq, 0, 2, 4, 'trap').panels[3].xs).toEqual([1.5, 2]);
    const simpson = riemannSum(sq, 0, 2, 4, 'simpson');
    expect(simpson.panels).toHaveLength(2);
    expect(simpson.panels[1]).toEqual({ a: 1, b: 2, xs: [1, 1.5, 2], ys: [1, 2.25, 4] });
  });

  it('a > b gives the signed sum', () => {
    expect(riemannSum(sq, 2, 0, 4, 'left').value).toBeCloseTo(-3.75, 12);
  });

  it('fills a removable hole with the limit (sin(x)/x at 0)', () => {
    const r = riemannSum((x) => Math.sin(x) / x, 0, 1, 2, 'trap');
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(0.25 * (1 + (2 * Math.sin(0.5)) / 0.5 + Math.sin(1)), 6);
  });

  it('a sample on a pole makes the sum undefined, not a number', () => {
    const r = riemannSum((x) => 1 / x, 0, 1, 4, 'left');
    expect(r.status).toBe('undefined');
    expect(r.value).toBeNaN();
    expect(r.badPoint).toBe(0);
  });

  it('rejects an invalid n', () => {
    expect(() => riemannSum(sq, 0, 1, 3, 'simpson')).toThrow(RangeError);
    expect(() => riemannSum(sq, 0, 1, 0, 'left')).toThrow(RangeError);
    expect(() => riemannSum(sq, 0, 1, 2.5, 'mid')).toThrow(RangeError);
  });
});
