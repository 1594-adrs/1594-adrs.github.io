import { describe, it, expect } from 'vitest';
import { detectCurveMode, unwrapParametricPair } from './mode-detector';

describe('detectCurveMode', () => {
  it('detects r=cos(theta) as polar', () => {
    expect(detectCurveMode('r=cos(theta)')).toBe('polar');
  });

  it('detects an inequality as implicit', () => {
    expect(detectCurveMode('y>x^2')).toBe('implicit');
  });

  it('detects cos(t),sin(t) as parametric', () => {
    expect(detectCurveMode('cos(t),sin(t)')).toBe('parametric');
  });

  it('detects the parenthesized pair (cos(t),sin(t)) as parametric', () => {
    expect(detectCurveMode('(cos(t), sin(t))')).toBe('parametric');
    expect(detectCurveMode(' (t, t^2) ')).toBe('parametric');
  });

  it('treats a constant pair (1, 2) like 1, 2 (a point)', () => {
    expect(detectCurveMode('1, 2')).toBe('parametric');
    expect(detectCurveMode('(1, 2)')).toBe('parametric');
  });

  it('does not unwrap other parenthesized forms', () => {
    expect(unwrapParametricPair('(a),(b)')).toBe('(a),(b)');
    expect(unwrapParametricPair('(x+1)')).toBe('(x+1)');
    expect(unwrapParametricPair('(sin(t), cos(t))')).toBe('sin(t), cos(t)');
    expect(detectCurveMode('(x+1)')).toBe('explicit');
    expect(detectCurveMode('(x,y)^2')).toBe('explicit');
  });

  it('detects x=cos(t),y=sin(t) as parametric (comma wins over x=)', () => {
    expect(detectCurveMode('x=cos(t),y=sin(t)')).toBe('parametric');
  });

  it('detects min(x,1)+t as explicit (comma inside parens)', () => {
    expect(detectCurveMode('min(x,1)+t')).toBe('explicit');
  });

  it('detects x^2+y^2=1 as implicit', () => {
    expect(detectCurveMode('x^2+y^2=1')).toBe('implicit');
  });

  it('detects y=x^2 as explicit', () => {
    expect(detectCurveMode('y=x^2')).toBe('explicit');
  });

  it('detects x=y^2 as explicit-y', () => {
    expect(detectCurveMode('x=y^2')).toBe('explicit-y');
  });

  it('detects x = sqrt(4-y^2) as explicit-y (spaced)', () => {
    expect(detectCurveMode('x = sqrt(4-y^2)')).toBe('explicit-y');
  });

  it('keeps x=y^2+x as implicit (rhs references x)', () => {
    expect(detectCurveMode('x=y^2+x')).toBe('implicit');
  });

  it('keeps a bare x=3 as implicit (no y dependence, existing behavior)', () => {
    expect(detectCurveMode('x=3')).toBe('implicit');
  });

  it('does not confuse exp(y) rhs with a bare x (word boundary)', () => {
    expect(detectCurveMode('x=exp(y)')).toBe('explicit-y');
  });
});
