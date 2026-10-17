import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { parse } from '../engine/parser';
import type { MathExpression } from '../models/calculator.models';
import { CalculusToolState } from './calculus-tool.state';
import { RADIANS_REASON } from './derivative-view';

function row(raw: string): MathExpression {
  return { raw, ast: parse(raw), color: '#00ff88', visible: true, mode: 'explicit', error: null };
}

describe('CalculusToolState: taylor / ode / series', () => {
  let state: CalculusToolState;
  const fns = signal<MathExpression[]>([]);
  const unit = signal<'rad' | 'deg'>('rad');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CalculusToolState] });
    state = TestBed.inject(CalculusToolState);
    unit.set('rad');
    state.connect(fns, unit);
    state.open.set(true);
  });

  it('is null unless its own mode is active', () => {
    fns.set([row('sin(x)')]);
    expect(state.taylor()).toBeNull();
    expect(state.ode()).toBeNull();
    expect(state.series()).toBeNull();
  });

  describe('taylor', () => {
    beforeEach(() => state.mode.set('taylor'));

    it('sin at 0, order 3', () => {
      fns.set([row('sin(x)')]);
      const v = state.taylor()!;
      expect(v.coefficients[1]).toBeCloseTo(1, 12);
      expect(v.coefficients[2]).toBeCloseTo(0, 12);
      expect(v.coefficients[3]).toBeCloseTo(-1 / 6, 12);
      expect(v.text).toContain('x³');
      expect(v.polynomial).not.toBeNull();
      expect(v.evaluate(0.5)).toBeCloseTo(0.5 - 0.125 / 6, 12);
      expect(v.message).toBeNull();
    });

    it('is blocked in DEG mode for trig', () => {
      fns.set([row('sin(x)')]);
      unit.set('deg');
      expect(state.taylorBlocked()).toBe(RADIANS_REASON);
      expect(state.taylor()).toBeNull();
    });

    it('(1 - cos x)/x² at 0, order 2', () => {
      fns.set([row('(1-cos(x))/x^2')]);
      state.taylorOrderText.set('2');
      const c = state.taylor()!.coefficients;
      expect(c[0]).toBeCloseTo(0.5, 10);
      expect(c[1]).toBeCloseTo(0, 10);
      expect(c[2]).toBeCloseTo(-1 / 24, 10);
    });

    it('explains non-analytic points and rejects bad orders', () => {
      fns.set([row('sqrt(x)')]);
      expect(state.taylor()!.message).toBe('f is not analytic at x = 0.');
      state.taylorOrderText.set('13');
      expect(state.taylorOrder().invalid).toBe(true);
      expect(state.taylor()).toBeNull();
    });
  });

  describe('ode', () => {
    beforeEach(() => state.mode.set('ode'));

    it("euler y'=y, h=0.5 to x=1 gives 2.25 in 3 rows", () => {
      state.odeSlopeText.set('y');
      state.odeMethod.set('euler');
      state.odeXEndText.set('1');
      const v = state.ode()!;
      expect(v.error).toBeNull();
      expect(v.end?.value).toBeCloseTo(2.25, 12);
      expect(v.rows.map((r) => r.n)).toEqual([0, 1, 2]);
      expect(v.rows[2].y).toBeCloseTo(2.25, 12);
    });

    it("rk45 y'=y reaches e", () => {
      state.odeSlopeText.set('y');
      state.odeXEndText.set('1');
      expect(Math.abs(state.ode()!.end!.value - Math.E)).toBeLessThan(1e-8);
    });

    it('reports invalid slope text and unknown names', () => {
      state.odeSlopeText.set('x +');
      expect(state.ode()!.error).not.toBeNull();
      state.odeSlopeText.set('x + z');
      expect(state.ode()!.error).toContain('z');
    });

    it('caps the table at 200 rows and says so', () => {
      state.odeSlopeText.set('y');
      state.odeMethod.set('rk4');
      state.odeStepText.set('0.01');
      state.odeXEndText.set('5');
      const v = state.ode()!;
      expect(v.rows).toHaveLength(200);
      expect(v.text).toContain('first 200');
    });
  });

  describe('series', () => {
    beforeEach(() => state.mode.set('series'));

    it('1/n² sums to π²/6, tends to 0', () => {
      const v = state.series()!;
      expect(v.sum.value).toBeCloseTo(Math.PI ** 2 / 6, 8);
      expect(v.limit.value).toBeCloseTo(0, 10);
      expect(v.rows).toHaveLength(10);
      expect(v.rows[0]).toEqual({ n: 1, a: 1, s: 1 });
    });

    it('1/n diverges', () => {
      state.seriesTermText.set('1/n');
      const v = state.series()!;
      expect(v.sum.status).toBe('infinite');
      expect(v.sumText).toBe('∞');
    });

    it('rejects a bad start index and a bad term', () => {
      state.seriesStartText.set('1.5');
      expect(state.series()!.error).not.toBeNull();
      state.seriesStartText.set('1');
      state.seriesTermText.set('1/(');
      expect(state.series()!.error).not.toBeNull();
    });
  });
});
