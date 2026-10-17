import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { parse } from '../engine/parser';
import type { MathExpression } from '../models/calculator.models';
import { IntegralExtrasState, centroidFor, type ActiveIntegral } from './integral-extras.state';

function row(raw: string): MathExpression {
  return { raw, ast: parse(raw), color: '#00ff88', visible: true, mode: 'explicit', error: null };
}

describe('IntegralExtrasState', () => {
  let state: IntegralExtrasState;
  const fns = signal<MathExpression[]>([]);
  const intg = signal<ActiveIntegral | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [IntegralExtrasState] });
    state = TestBed.inject(IntegralExtrasState);
    state.connect(fns, signal<'rad' | 'deg'>('rad'), intg);
    fns.set([row('x^2')]);
    intg.set({ fnIndex: 0, a: 0, b: 2 });
  });

  it('is null while the rule is off', () => {
    expect(state.riemannRule()).toBeNull();
    expect(state.riemann()).toBeNull();
  });

  it('midpoint n=4 on x^2 over [0, 2]', () => {
    state.riemannRule.set('mid');
    state.riemannNText.set('4');
    const v = state.riemann()!;
    expect(v.value).toBeCloseTo(2.625, 12);
    expect(v.exact).toBeCloseTo(8 / 3, 9);
    expect(v.error).toBeCloseTo(8 / 3 - 2.625, 9);
    expect(v.message).toBeNull();
    expect(v.panels).toHaveLength(4);
  });

  it('reports an inline message for odd n with Simpson and for out-of-range n', () => {
    state.riemannRule.set('simpson');
    state.riemannNText.set('5');
    expect(state.riemann()!.message).toMatch(/even/);
    state.riemannRule.set('left');
    state.riemannNText.set('1001');
    expect(state.riemann()!.message).toMatch(/1 to 1000/);
    state.riemannNText.set('2.5');
    expect(state.riemann()!.message).not.toBeNull();
    expect(state.riemann()!.invalidN).toBe(true);
  });

  it('needs finite limits: message and no panels for [0, Infinity]', () => {
    intg.set({ fnIndex: 0, a: 0, b: Infinity });
    state.riemannRule.set('mid');
    const v = state.riemann()!;
    expect(v.message).toMatch(/finite limits/);
    expect(v.panels).toHaveLength(0);
  });

  it('arc length over [0, Infinity] is divergent', () => {
    intg.set({ fnIndex: 0, a: 0, b: Infinity });
    const v = state.arcLength()!;
    expect(v.status).toBe('divergent');
    expect(v.text).toBe('divergent');
  });

  it('has no error to report when the integral diverges', () => {
    fns.set([row('1/x')]);
    intg.set({ fnIndex: 0, a: -1, b: 1 });
    state.riemannRule.set('mid');
    const v = state.riemann()!;
    expect(v.exact).toBeNaN();
    expect(v.error).toBeNull();
    expect(v.note).not.toBeNull();
  });

  it('blames f, not n, when a sample point is undefined', () => {
    fns.set([row('1/x')]);
    intg.set({ fnIndex: 0, a: -1, b: 1 });
    state.riemannRule.set('left');
    state.riemannNText.set('2');
    const v = state.riemann()!;
    expect(v.message).toMatch(/undefined/);
    expect(v.invalidN).toBe(false);
  });

  it('omits the relative error when the exact value is round-off around 0', () => {
    fns.set([row('sin(x)')]);
    intg.set({ fnIndex: 0, a: 0, b: 2 * Math.PI });
    state.riemannRule.set('mid');
    const v = state.riemann()!;
    expect(v.error).not.toBeNull();
    expect(v.relError).toBeNull();
  });

  it('arc length of x over [0, 1] is sqrt(2)', () => {
    fns.set([row('x')]);
    intg.set({ fnIndex: 0, a: 0, b: 1 });
    expect(state.arcLength()!.value).toBeCloseTo(Math.SQRT2, 9);
  });

  it('arc length without a symbolic derivative gives the friendly text', () => {
    fns.set([row('gamma(x)')]);
    intg.set({ fnIndex: 0, a: 1, b: 2 });
    expect(state.arcLength()!.text).toMatch(/differentiable/);
  });
});

describe('centroidFor', () => {
  it('single curve y = x on [0, 1] is (2/3, 1/3)', () => {
    const c = centroidFor({ mode: 'single', fn: (x) => x, a: 0, b: 1 })!;
    expect(c.x).toBeCloseTo(2 / 3, 9);
    expect(c.y).toBeCloseTo(1 / 3, 9);
  });

  it('is null without geometry', () => {
    expect(centroidFor(null)).toBeNull();
  });
});
