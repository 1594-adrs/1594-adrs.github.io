import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { parse } from '../engine/parser';
import type { MathExpression } from '../models/calculator.models';
import { CalculusToolState, limitText, parseLimitPoint } from './calculus-tool.state';
import { RADIANS_REASON } from './derivative-view';

function row(raw: string, mode: MathExpression['mode'] = 'explicit'): MathExpression {
  return { raw, ast: parse(raw), color: '#00ff88', visible: true, mode, error: null };
}

describe('parseLimitPoint', () => {
  it('reads infinity in every spelling the math field may produce', () => {
    for (const s of ['inf', 'INF', 'i*n*f', '+inf', 'infinity', 'oo', '∞', '\\infty']) {
      expect(parseLimitPoint(s).value).toBe(Infinity);
    }
    expect(parseLimitPoint('-inf').value).toBe(-Infinity);
    expect(parseLimitPoint('- i * n * f').value).toBe(-Infinity);
  });

  it('falls back to constant expressions and flags garbage', () => {
    expect(parseLimitPoint('pi/2').value).toBeCloseTo(Math.PI / 2, 12);
    expect(parseLimitPoint('').value).toBeNull();
    expect(parseLimitPoint('inff').invalid).toBe(true);
  });
});

describe('CalculusToolState', () => {
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

  it('only offers visible explicit rows and falls back to the first one', () => {
    fns.set([row('t', 'polar'), row('x^2'), { ...row('x'), visible: false }]);
    expect(state.choices().map((c) => c.label)).toEqual(['f2']);
    state.fnIndex.set(0);
    expect(state.selected()?.index).toBe(1);
  });

  it('limit of sin(x)/x at 0 is 1', () => {
    fns.set([row('sin(x)/x')]);
    state.limitX0Text.set('0');
    expect(state.limit()?.text).toBe('1');
  });

  it('limit of 1/x at 0 does not exist, saying the one-sided limits differ', () => {
    fns.set([row('1/x')]);
    state.limitX0Text.set('0');
    const v = state.limit()!;
    expect(v.text).toBe('does not exist');
    expect(v.detail).toBe('left -∞ · right ∞: the one-sided limits differ.');
    state.side.set('+');
    expect(state.limit()?.text).toBe('∞');
    expect(state.limit()?.detail).toBeNull();
  });

  it('says which side does not exist instead of "differ"', () => {
    fns.set([row('sin(1/x)')]);
    state.limitX0Text.set('0');
    expect(state.limit()!.detail).toBe('Neither one-sided limit exists.');
    fns.set([row('(sign(x)+1)/2*sin(1/x)+(1-sign(x))/2*x')]);
    expect(state.limit()!.detail).toBe(
      'The right-hand limit does not exist (the left-hand limit is 0).',
    );
  });

  it('sqrt(x) at -1 is coherent on every side: undefined near the point', () => {
    fns.set([row('sqrt(x)')]);
    state.limitX0Text.set('-1');
    for (const side of ['both', '-', '+'] as const) {
      state.side.set(side);
      const v = state.limit()!;
      expect(v.text).toBe('does not exist');
      expect(v.detail).toMatch(/^f is undefined /);
    }
    state.side.set('both');
    expect(state.limit()!.detail).toBe('f is undefined near x = −1.');
  });

  it('a constant non-finite row (1/0) has no limit, not infinity', () => {
    fns.set([row('1/0')]);
    state.limitX0Text.set('2');
    expect(state.limit()!.text).toBe('does not exist');
    expect(state.limit()!.detail).toBe('f is undefined everywhere.');
    state.limitX0Text.set('inf');
    expect(state.limit()!.text).toBe('does not exist');
  });

  it('keeps the selection on the same row when rows are removed or moved', () => {
    fns.set([row('x'), row('x^2'), row('x^3')]);
    state.select(2);
    state.handleFunctionRemoved(0);
    expect(state.selected()?.label).toBe('f2');
    expect(state.fnIndex()).toBe(1);
    state.handleFunctionMoved(1, 0);
    expect(state.fnIndex()).toBe(0);
  });

  it('falls back explicitly when the selected row is removed', () => {
    fns.set([row('x'), row('x^2')]);
    state.select(1);
    state.handleFunctionRemoved(1);
    fns.set([row('x')]);
    expect(state.selected()?.label).toBe('f1');
    expect(state.selectionNote()).toBe('f2 was removed. Showing f1.');
    state.select(0);
    expect(state.selectionNote()).toBeNull();
  });

  it('limit at inf of (1+1/x)^x is e', () => {
    fns.set([row('(1+1/x)^x')]);
    state.limitX0Text.set('inf');
    expect(Number(state.limit()?.text)).toBeCloseTo(Math.E, 5);
  });

  it('runs Newton on x^2 - 2 from 1 to sqrt(2), with a row per iterate', () => {
    fns.set([row('x^2-2')]);
    state.mode.set('newton');
    state.newtonX0Text.set('1');
    const v = state.newton()!;
    expect(v.status).toBe('converged');
    expect(v.value).toBeCloseTo(Math.SQRT2, 12);
    expect(v.rows[0]).toEqual({ n: 0, x: 1, fx: -1 });
    expect(v.message).toMatch(/^Root ≈ 1\.414214/);
  });

  it('honours a fixed step count and rejects bad step text', () => {
    fns.set([row('x^2-2')]);
    state.mode.set('newton');
    state.stepsText.set('2');
    expect(state.newton()!.rows).toHaveLength(3);
    expect(state.newton()!.status).toBe('steps');
    state.stepsText.set('0');
    expect(state.steps().invalid).toBe(true);
    expect(state.newton()).toBeNull();
  });

  it('explains a zero derivative and refuses trig in DEG mode', () => {
    fns.set([row('x^2+1')]);
    state.mode.set('newton');
    state.newtonX0Text.set('0');
    expect(state.newton()!.message).toMatch(/f′\(x0\) = 0/);
    fns.set([row('cos(x)-x')]);
    unit.set('deg');
    expect(state.newtonBlocked()).toBe(RADIANS_REASON);
    expect(state.newton()).toBeNull();
  });

  it('computes nothing while the tool is closed', () => {
    fns.set([row('x')]);
    state.open.set(false);
    expect(state.limit()).toBeNull();
  });
});
