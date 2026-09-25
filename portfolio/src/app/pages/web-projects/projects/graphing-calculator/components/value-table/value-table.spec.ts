import { TestBed } from '@angular/core/testing';
import { ValueTable } from './value-table';
import { parse } from '../../engine/parser';
import type { MathExpression } from '../../models/calculator.models';

function makeExpr(raw: string, mode: MathExpression['mode'] = 'explicit'): MathExpression {
  return {
    raw,
    ast: parse(mode === 'explicit-y' ? raw.replace(/^[xX]\s*=\s*/, '') : raw),
    color: '#00ff88',
    visible: true,
    mode,
    error: null,
  };
}

describe('ValueTable', () => {
  function create(expr: MathExpression) {
    const fixture = TestBed.createComponent(ValueTable);
    fixture.componentRef.setInput('expr', expr);
    fixture.detectChanges();
    return fixture;
  }

  it('computes default rows (start 0, step 1, 11 rows)', () => {
    const fixture = create(makeExpr('x^2'));
    const rows = fixture.componentInstance.rows();
    expect(rows.length).toBe(11);
    expect(rows[0].input).toBe(0);
    expect(rows[0].output).toBe('0');
    expect(rows[2].input).toBe(2);
    expect(rows[2].output).toBe('4.000000');
  });

  it('flags a zero step as invalid and produces no rows', () => {
    const fixture = create(makeExpr('x'));
    fixture.componentInstance.setStep('0');
    fixture.detectChanges();
    expect(fixture.componentInstance.stepError()).toBe('Step must not be 0.');
    expect(fixture.componentInstance.rows().length).toBe(0);
  });

  it('flags more than 200 rows as invalid', () => {
    const fixture = create(makeExpr('x'));
    fixture.componentInstance.setRows('201');
    fixture.detectChanges();
    expect(fixture.componentInstance.rowsError()).toContain('at most 200');
    expect(fixture.componentInstance.rows().length).toBe(0);
  });

  it('shows "—" for values undefined at a sample point', () => {
    const fixture = create(makeExpr('1/x'));
    fixture.componentInstance.setStart('-1');
    fixture.componentInstance.setStep('1');
    fixture.componentInstance.setRows('3');
    fixture.detectChanges();
    const rows = fixture.componentInstance.rows();
    // start=-1, step=1, rows=3 -> x = -1, 0, 1
    expect(rows.map((r) => r.input)).toEqual([-1, 0, 1]);
    expect(rows[1].output).toBe('—');
  });

  it('uses the y column for explicit-y (x = g(y)) rows', () => {
    const fixture = create(makeExpr('x=y^2', 'explicit-y'));
    expect(fixture.componentInstance.inputVariable()).toBe('y');
    const rows = fixture.componentInstance.rows();
    expect(rows.length).toBe(11);
    expect(rows[2].output).toBe('4.000000');
  });
});
