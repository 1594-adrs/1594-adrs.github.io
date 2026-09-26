import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { IntegralFormulaComponent } from './integral-formula.component';
import type { SolidIntegralTerm } from '../../engine/solids/solid.types';
import type { ExpressionNode } from '../../engine/parser';

function numberNode(value: number): ExpressionNode {
  return { type: 'NumberLiteral', value };
}

function xSquared(): ExpressionNode {
  return {
    type: 'BinaryOp',
    operator: '^',
    left: { type: 'Variable', name: 'x' },
    right: numberNode(2),
  };
}

describe('IntegralFormulaComponent', () => {
  it('renders one term with a coefficient, the ∫ sign and dx', () => {
    const fixture = TestBed.createComponent(IntegralFormulaComponent);
    const term: SolidIntegralTerm = {
      coefficient: { type: 'Variable', name: 'π' },
      a: 0,
      b: 1,
      integrand: xSquared(),
      variable: 'x',
    };
    fixture.componentRef.setInput('terms', [term]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('∫');
    expect(host.textContent).toContain('dx');
    expect(host.querySelector('.limit-upper')?.textContent).toBe('1');
    expect(host.querySelector('.limit-lower')?.textContent).toBe('0');
  });

  it('formats a π-form limit via recognizeExact', () => {
    const fixture = TestBed.createComponent(IntegralFormulaComponent);
    const term: SolidIntegralTerm = {
      coefficient: null,
      a: 0,
      b: Math.PI / 3,
      integrand: numberNode(1),
      variable: 'x',
    };
    fixture.componentRef.setInput('terms', [term]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.limit-upper')?.textContent).toBe('π/3');
  });

  it('joins two terms with a plus sign', () => {
    const fixture = TestBed.createComponent(IntegralFormulaComponent);
    const term: SolidIntegralTerm = {
      coefficient: null,
      a: 0,
      b: 1,
      integrand: numberNode(1),
      variable: 'x',
    };
    fixture.componentRef.setInput('terms', [term, term]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.plus').length).toBe(1);
  });

  it('builds a spoken aria-label alternative', () => {
    const fixture = TestBed.createComponent(IntegralFormulaComponent);
    const term: SolidIntegralTerm = {
      coefficient: { type: 'Variable', name: 'π' },
      a: 0,
      b: 1,
      integrand: xSquared(),
      variable: 'x',
    };
    fixture.componentRef.setInput('terms', [term]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const label = host.querySelector('.integral-formula')?.getAttribute('aria-label');
    expect(label).toContain('pi times integral from 0 to 1 of x squared dx');
  });
});
