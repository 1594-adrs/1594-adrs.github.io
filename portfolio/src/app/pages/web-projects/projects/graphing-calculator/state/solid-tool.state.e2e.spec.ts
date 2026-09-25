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

describe('SolidToolState E2E', () => {
  let state: SolidToolState;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SolidToolState] });
    state = TestBed.inject(SolidToolState);
  });

  it('1: y=x, [0,1], disk-washer, k=0 -> π/3, "π/3"', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(Math.PI / 3, 6);
    expect(result!.exact).toBe('π/3');
  });

  it('2: y=sqrt(x), [0,4], disk-washer, k=0 -> 8π', () => {
    state.connect(signal<MathExpression[]>([explicitFn('sqrt(x)')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('4');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(8 * Math.PI, 6);
    expect(result!.exact).toBe('8π');
  });

  it('3: y=sqrt(1-x^2), [-1,1], disk-washer, k=0 -> 4π/3', () => {
    state.connect(signal<MathExpression[]>([explicitFn('sqrt(1-x^2)')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('-1');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((4 * Math.PI) / 3, 6);
    expect(result!.exact).toBe('4π/3');
  });

  it('4: y=x & y=x^2, [0,1], disk-washer, k=0 -> 2π/15', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('x', FUNCTION_COLORS[0]),
        explicitFn('x^2', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((2 * Math.PI) / 15, 6);
    expect(result!.exact).toBe('2π/15');
  });

  it('5: y=x & y=x^2, [0,1], disk-washer, k=-1 -> 7π/15', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('x', FUNCTION_COLORS[0]),
        explicitFn('x^2', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('-1');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((7 * Math.PI) / 15, 6);
    expect(result!.exact).toBe('7π/15');
  });

  it('6: x=y^2 (explicit-y), [0,1], disk-washer, k=0 -> π/5, variable=y, axisOrientation=vertical', () => {
    state.connect(signal<MathExpression[]>([explicitYFn('y^2')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    expect(state.variable()).toBe('y');
    expect(state.axisOrientation()).toBe('vertical');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(Math.PI / 5, 6);
    expect(result!.exact).toBe('π/5');
  });

  it('7: y=x^2, [0,1], shell, k=0 -> π/2, axisOrientation=vertical', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x^2')]));
    state.toggleCurve(0);
    state.setMethod('shell');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    expect(state.axisOrientation()).toBe('vertical');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(Math.PI / 2, 6);
    expect(result!.exact).toBe('π/2');
  });

  it('8: y=x^2, [0,1], shell, k=2 -> 5π/6', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x^2')]));
    state.toggleCurve(0);
    state.setMethod('shell');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('2');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((5 * Math.PI) / 6, 6);
    expect(result!.exact).toBe('5π/6');
  });

  it('8b: y=ln(x), [0,1], disk-washer, k=0 -> 2π (improper, pole at 0)', () => {
    state.connect(signal<MathExpression[]>([explicitFn('ln(x)')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(2 * Math.PI, 5);
    expect(result!.exact).toBe('2π');
  });

  it('9: y=x^(1/3), [-1,1], disk-washer, k=0 -> 6π/5', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x^(1/3)')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('-1');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((6 * Math.PI) / 5, 6);
    expect(result!.exact).toBe('6π/5');
  });

  it('10: y=sqrt(1-x^2) & y=-sqrt(1-x^2), [-1,1], cross-section square -> 16/3', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('sqrt(1-x^2)', FUNCTION_COLORS[0]),
        explicitFn('-sqrt(1-x^2)', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('-1');
    state.setB('1');
    state.setShape('square');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(16 / 3, 6);
    expect(result!.exact).toBe('16/3');
  });

  it('11: same base, semicircle -> 2π/3', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('sqrt(1-x^2)', FUNCTION_COLORS[0]),
        explicitFn('-sqrt(1-x^2)', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('-1');
    state.setB('1');
    state.setShape('semicircle');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((2 * Math.PI) / 3, 6);
    expect(result!.exact).toBe('2π/3');
  });

  it('12: same base, equilateral-triangle -> 4√3/3', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('sqrt(1-x^2)', FUNCTION_COLORS[0]),
        explicitFn('-sqrt(1-x^2)', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('-1');
    state.setB('1');
    state.setShape('equilateral-triangle');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo((4 * Math.sqrt(3)) / 3, 6);
    expect(result!.exact).toBe('4√3/3');
  });

  it('13: y=x & y=x^2, [0,1], right-isosceles-leg -> 1/60', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('x', FUNCTION_COLORS[0]),
        explicitFn('x^2', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('0');
    state.setB('1');
    state.setShape('right-isosceles-leg');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(1 / 60, 6);
    expect(result!.exact).toBe('1/60');
  });

  it('14: y=sqrt(x), [0,4], rectangle ratio 2 -> 16', () => {
    state.connect(signal<MathExpression[]>([explicitFn('sqrt(x)')]));
    state.toggleCurve(0);
    state.setMethod('cross-section');
    state.setA('0');
    state.setB('4');
    state.setShape('rectangle');
    state.setHeightRatio('2');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).toBeCloseTo(16, 6);
    expect(result!.exact).toBe('16');
  });

  it('15a: a="2", b="1" -> no result, fieldErrors has bounds error', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('2');
    state.setB('1');
    state.setAxisValue('0');
    expect(state.result()).toBeNull();
    expect(state.fieldErrors().a).toBeTruthy();
  });

  it('15b: y=1/x on [-1,1] -> divergent issue', () => {
    state.connect(signal<MathExpression[]>([explicitFn('1/x')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('-1');
    state.setB('1');
    state.setAxisValue('0');
    expect(state.result()?.volume ?? null).toBeNull();
    const issues = state.issues();
    expect(issues.some((i) => i.code === 'divergent')).toBe(true);
  });

  it('15c: y=sqrt(x) on [-1,1] -> undefined-domain issue', () => {
    state.connect(signal<MathExpression[]>([explicitFn('sqrt(x)')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('-1');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).toBeNull();
    const issues = state.issues();
    expect(issues.some((i) => i.code === 'undefined-domain')).toBe(true);
  });

  it('15d: shell y=x^2 [0,1] k=0.5 -> warning axis-inside-region and still a volume', () => {
    state.connect(signal<MathExpression[]>([explicitFn('x^2')]));
    state.toggleCurve(0);
    state.setMethod('shell');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0.5');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.volume).not.toBeNull();
    const issues = state.issues();
    expect(issues.some((i) => i.code === 'axis-inside-region')).toBe(true);
  });

  it('16a: envelope x, x^2, x^3 on [0,1], disk-washer, k=0 -> 4pi/21 (upper x, lower x^3)', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('x', FUNCTION_COLORS[0]),
        explicitFn('x^2', FUNCTION_COLORS[1]),
        explicitFn('x^3', FUNCTION_COLORS[2]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.toggleCurve(2);
    state.setMethod('disk-washer');
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.pieces).toHaveLength(1);
    expect(result!.pieces[0].upperIndex).toBe(0);
    expect(result!.pieces[0].lowerIndex).toBe(2);
    expect(result!.volume).toBeCloseTo((4 * Math.PI) / 21, 6);
    expect(result!.exact).toBe('4π/21');
  });

  it('16b: sphere y=sqrt(1-x^2), [-1,1], disk-washer, k=0 -> surfaceArea 4pi', () => {
    state.connect(signal<MathExpression[]>([explicitFn('sqrt(1-x^2)')]));
    state.toggleCurve(0);
    state.setMethod('disk-washer');
    state.setA('-1');
    state.setB('1');
    state.setAxisValue('0');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.surfaceArea).not.toBeNull();
    expect(result!.surfaceArea!).toBeCloseTo(4 * Math.PI, 6);
    expect(result!.surfaceExact).toBe('4π');
  });

  it('16c: cross-section surfaceArea is always null', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('sqrt(1-x^2)', FUNCTION_COLORS[0]),
        explicitFn('-sqrt(1-x^2)', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('-1');
    state.setB('1');
    state.setShape('square');
    const result = state.result();
    expect(result).not.toBeNull();
    expect(result!.surfaceArea).toBeNull();
  });

  it('15e: heightRatio "0" for rectangle -> bad-ratio', () => {
    state.connect(
      signal<MathExpression[]>([
        explicitFn('sqrt(1-x^2)', FUNCTION_COLORS[0]),
        explicitFn('-sqrt(1-x^2)', FUNCTION_COLORS[1]),
      ]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('-1');
    state.setB('1');
    state.setShape('rectangle');
    state.setHeightRatio('0');
    expect(state.result()).toBeNull();
    const fieldErrors = state.fieldErrors();
    expect(fieldErrors.ratio).toBeTruthy();
  });
});
