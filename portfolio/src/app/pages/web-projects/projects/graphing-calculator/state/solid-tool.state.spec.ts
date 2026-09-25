import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SolidToolState } from './solid-tool.state';
import { parse } from '../engine/parser';
import { FUNCTION_COLORS } from '../utils/color';
import type { MathExpression } from '../models/calculator.models';

function explicitFn(raw: string, color = FUNCTION_COLORS[0]): MathExpression {
  return { raw, ast: parse(raw), color, visible: true, mode: 'explicit', error: null };
}

/** `rhs` is the y-side expression, e.g. 'y' for "x = y" (ast is stored in terms of y only). */
function explicitYFn(rhs: string, color = FUNCTION_COLORS[1]): MathExpression {
  return {
    raw: `x=${rhs}`,
    ast: parse(rhs),
    color,
    visible: true,
    mode: 'explicit-y',
    error: null,
  };
}

describe('SolidToolState', () => {
  let state: SolidToolState;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SolidToolState] });
    state = TestBed.inject(SolidToolState);
  });

  it('has no spec until a curve is selected', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    expect(state.spec()).toBeNull();
    expect(state.issues().some((i) => i.code === 'no-curves')).toBe(true);
  });

  it('computes disk/washer volume for y=x on [0,1] as π/3', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('0');
    state.setB('1');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(Math.PI / 3, 5);
    expect(result!.exact).toBe('π/3');
  });

  it('infers variable y from an explicit-y curve and derives axis orientation', () => {
    state.connect(signal<MathExpression[]>([explicitYFn('y')]));
    state.toggleCurve(0);
    expect(state.variable()).toBe('y');
    // disk-washer + variable y -> vertical axis (x = k)
    expect(state.axisOrientation()).toBe('vertical');
  });

  it('reports a field error for a >= b', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('2');
    state.setB('1');
    expect(state.fieldErrors().a).toBeTruthy();
  });

  it('reports an invalid-expression field error for an unparsable bound', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('not-a-number');
    expect(state.fieldErrors().a).toBeTruthy();
  });

  it('caps curve selection at 2', () => {
    state.connect(
      signal<MathExpression[]>([explicitFn('x'), explicitFn('x+1'), explicitFn('x+2')]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.toggleCurve(2);
    expect(state.curveIndices()).toEqual([0, 1]);
  });

  it('disables an explicit-y curve when the variable is x', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x'), explicitYFn('y')]));
    state.toggleCurve(0);
    const options = state.curveOptions();
    expect(options[1].compatible).toBe(false);
  });

  it('shifts curve indices when a function row is removed', () => {
    state.connect(
      signal<MathExpression[]>([explicitFn('x'), explicitFn('x+1'), explicitFn('x+2')]),
    );
    state.toggleCurve(2);
    state.handleFunctionRemoved(0);
    expect(state.curveIndices()).toEqual([1]);
  });

  it('exposes sweepArea for a set sweepT', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('0');
    state.setB('1');
    state.setSweepT(0.5);
    expect(state.sweepArea()).toBeCloseTo(Math.PI * 0.25, 5);
  });
});
