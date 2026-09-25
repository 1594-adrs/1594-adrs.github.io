import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SolidPanelComponent } from './solid-panel.component';
import { SolidToolState } from '../../state/solid-tool.state';
import { parse } from '../../engine/parser';
import { FUNCTION_COLORS } from '../../utils/color';
import type { MathExpression } from '../../models/calculator.models';

function explicitFn(raw: string): MathExpression {
  return {
    raw,
    ast: parse(raw),
    color: FUNCTION_COLORS[0],
    visible: true,
    mode: 'explicit',
    error: null,
  };
}

/** `rhs` is the y-side expression, e.g. 'y' for "x = y" (ast is stored in terms of y only). */
function explicitYFn(rhs: string): MathExpression {
  return {
    raw: `x=${rhs}`,
    ast: parse(rhs),
    color: FUNCTION_COLORS[1],
    visible: true,
    mode: 'explicit-y',
    error: null,
  };
}

describe('SolidPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SolidToolState] });
  });

  it('renders one-line guidance for each method', () => {
    const fixture = TestBed.createComponent(SolidPanelComponent);
    fixture.componentInstance.state.connect(signal<MathExpression[]>([explicitFn('x')]));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Slices perpendicular to the axis');
    expect(text).toContain('Cylindrical shells parallel to the axis');
    expect(text).toContain('V = ∫ A(x) dx');
  });

  it('disables an incompatible curve checkbox', () => {
    const fixture = TestBed.createComponent(SolidPanelComponent);
    const state = fixture.componentInstance.state;
    state.connect(signal<MathExpression[]>([explicitFn('x'), explicitYFn('y')]));
    state.toggleCurve(0);
    fixture.detectChanges();
    const checkboxes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      '.multi-fn-toggle input[type="checkbox"]',
    );
    expect(checkboxes[1].disabled).toBe(true);
  });

  it('shows an inline error when a >= b', () => {
    const fixture = TestBed.createComponent(SolidPanelComponent);
    const state = fixture.componentInstance.state;
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('2');
    state.setB('1');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('lower bound a must be less than the upper bound b');
  });

  it('shows the formula and exact value π/3 for y=x on [0,1] with disk/washer', () => {
    const fixture = TestBed.createComponent(SolidPanelComponent);
    const state = fixture.componentInstance.state;
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('0');
    state.setB('1');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('π/3');
  });

  it('shows the total surface area under the volume for y=x on [0,1] with disk/washer', () => {
    const fixture = TestBed.createComponent(SolidPanelComponent);
    const state = fixture.componentInstance.state;
    state.connect(signal<MathExpression[]>([explicitFn('x')]));
    state.toggleCurve(0);
    state.setA('0');
    state.setB('1');
    state.setAxisValue('0');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('S ≈');
    expect(text).toContain('π(1+√2)');
    expect(text).toContain('total surface');
  });

  it('does not show a surface line for a cross-section', () => {
    const fixture = TestBed.createComponent(SolidPanelComponent);
    const state = fixture.componentInstance.state;
    state.connect(
      signal<MathExpression[]>([explicitFn('sqrt(1-x^2)'), explicitFn('-sqrt(1-x^2)')]),
    );
    state.toggleCurve(0);
    state.toggleCurve(1);
    state.setMethod('cross-section');
    state.setA('-1');
    state.setB('1');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('total surface');
  });
});
