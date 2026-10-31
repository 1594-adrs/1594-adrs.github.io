import { describe, it, expect } from 'vitest';
import {
  atExcludedEdge,
  domainBounds,
  gatedConicBranches,
  insideDomain,
  intersectDomains,
  isEmptyDomain,
  splitDomain,
} from './domain';
import { parse, type ExpressionNode } from './parser';

describe('splitDomain', () => {
  it('returns the text unchanged without braces', () => {
    expect(splitDomain('y = x^2')).toEqual({ body: 'y = x^2', cond: null, error: null });
  });

  it.each([
    ['y = 3+2x-x^2 {-1 <= x <= 3}', 'y = 3+2x-x^2', '-1 <= x <= 3'],
    ['x = 1+sqrt(4-y) {0 <= y <= 4}', 'x = 1+sqrt(4-y)', '0 <= y <= 4'],
    ['x^2 {x >= 0}  ', 'x^2', 'x >= 0'],
    ['(cos(t), sin(t)){0<t<pi}', '(cos(t), sin(t))', '0<t<pi'],
  ])('%j splits into body and condition', (raw, body, cond) => {
    expect(splitDomain(raw)).toEqual({ body, cond, error: null });
  });

  it.each([
    ['y = x {x > 0', 'Unbalanced braces in the domain'],
    ['y = x }x > 0{', 'Unbalanced braces in the domain'],
    ['y = x {x > {0}}', 'Nested braces are not allowed in a domain'],
    ['y = x {x > 0}{x < 1}', 'Only one domain {…} is allowed'],
    ['y = x {x > 0} + 1', 'The domain {…} must come at the end'],
    ['y = x { }', 'The domain {…} is empty'],
    ['{x > 0}', 'Write the curve before its domain'],
  ])('%j is malformed', (raw, error) => {
    expect(splitDomain(raw)).toEqual({ body: raw, cond: null, error });
  });
});

describe('domainBounds', () => {
  const bounds = (cond: string, v: Parameters<typeof domainBounds>[1] = 'x') =>
    domainBounds(parse(cond), v);

  it('reads a chained interval', () => {
    expect(bounds('-1 <= x <= 3')).toEqual({
      variable: 'x',
      lo: -1,
      hi: 3,
      loStrict: false,
      hiStrict: false,
    });
  });

  it('reads a reversed chain and strict bounds', () => {
    expect(bounds('3 > x >= -1')).toEqual({
      variable: 'x',
      lo: -1,
      hi: 3,
      loStrict: false,
      hiStrict: true,
    });
  });

  it('reads one-sided bounds on either side of the variable', () => {
    expect(bounds('x >= 0')).toMatchObject({ lo: 0, hi: null, loStrict: false });
    expect(bounds('2 > x')).toMatchObject({ lo: null, hi: 2, hiStrict: true });
  });

  it('evaluates constant bound expressions', () => {
    const d = bounds('-sqrt(2) <= y <= pi/2', 'y')!;
    expect(d.lo).toBeCloseTo(-Math.SQRT2, 12);
    expect(d.hi).toBeCloseTo(Math.PI / 2, 12);
  });

  it('accepts t or x for the polar angle', () => {
    expect(bounds('0 <= t <= pi', 'theta')).toMatchObject({ variable: 'theta', lo: 0 });
    expect(bounds('0 <= x <= pi', 'theta')).toMatchObject({ variable: 'theta', lo: 0 });
  });

  it('substitutes slider values and is null for an unknown name', () => {
    expect(domainBounds(parse('0 <= x <= a'), 'x', { a: 3 })).toMatchObject({ lo: 0, hi: 3 });
    expect(domainBounds(parse('0 <= x <= a'), 'x')).toBeNull();
  });

  it('evaluates trig bounds in the given angle unit', () => {
    expect(domainBounds(parse('0 <= x <= sin(30)'), 'x', {}, 'deg')!.hi).toBeCloseTo(0.5, 12);
    expect(domainBounds(parse('0 <= x <= sin(30)'), 'x')!.hi).toBeCloseTo(Math.sin(30), 12);
  });

  it('flags an empty interval', () => {
    expect(isEmptyDomain(bounds('3 <= x <= 1')!)).toBe(true);
    expect(isEmptyDomain(bounds('1 < x <= 1')!)).toBe(true);
    expect(isEmptyDomain(bounds('1 <= x <= 1')!)).toBe(false);
    expect(isEmptyDomain(bounds('x >= 5')!)).toBe(false);
  });

  it('is null for conditions that are not an interval in the variable', () => {
    expect(bounds('x^2 < 4')).toBeNull();
    expect(bounds('x + y > 0')).toBeNull();
    expect(bounds('0 <= y <= 1')).toBeNull();
    expect(bounds('x > y')).toBeNull();
    expect(bounds('0 <= x >= 1')).toBeNull();
  });
});

describe('intersectDomains / insideDomain', () => {
  it('intersects the domains in one variable and ignores the others', () => {
    const a = domainBounds(parse('-1 <= x <= 3'), 'x');
    const b = domainBounds(parse('x >= 0'), 'x');
    const c = domainBounds(parse('0 <= y <= 9'), 'y');
    expect(intersectDomains([a, b, c, null], 'x')).toEqual({ lo: 0, hi: 3 });
    expect(intersectDomains([c], 'x')).toBeNull();
  });

  it('keeps endpoints out of the interior', () => {
    const d = domainBounds(parse('0 <= x <= 1'), 'x')!;
    expect(insideDomain(0.5, d)).toBe(true);
    expect(insideDomain(0, d)).toBe(false);
    expect(insideDomain(0.999, d, 0.01)).toBe(false);
  });

  it('marks only strict endpoints as excluded', () => {
    const d = domainBounds(parse('0 < x <= 1'), 'x')!;
    expect(atExcludedEdge(1e-26, d, 1e-9)).toBe(true);
    expect(atExcludedEdge(1, d, 1e-9)).toBe(false);
    expect(atExcludedEdge(0.5, d, 1e-9)).toBe(false);
    expect(atExcludedEdge(0, null, 1e-9)).toBe(false);
  });
});

describe('gatedConicBranches', () => {
  const eq = (l: string, r: string): ExpressionNode => ({
    type: 'BinaryOp',
    operator: '=',
    left: parse(l),
    right: parse(r),
  });

  const gatedRow = (l: string, r: string, cond: string) =>
    gatedConicBranches(eq(l, r), eq(`if(${cond}, ${l})`, `if(${cond}, ${r})`));

  it('cuts the circle to the upper branch for y >= 0', () => {
    const branches = gatedRow('x^2+y^2', '4', 'y>=0')!;
    expect(branches).toHaveLength(1);
    expect(branches[0].fn(0)).toBeCloseTo(2, 12);
  });

  it.each([
    ['x^2+y^2', '4', 'y<=0', 0, -2],
    ['x^2/4+y^2', '1', 'y<0', 0, -1],
    ['y^2', '4*x', 'y<=0', 1, -2],
  ])('puts the live branch first for %s = %s {%s}', (l, r, cond, x, y) => {
    const branches = gatedRow(l, r, cond)!;
    expect(branches[0].fn(x)).toBeCloseTo(y, 12);
  });

  it('keeps both branches when the gate is on x, and is null when it hides the conic', () => {
    expect(gatedRow('x^2+y^2', '4', 'x>1')).toHaveLength(2);
    expect(gatedRow('x^2+y^2', '4', 'y>5')).toBeNull();
  });

  it('returns the plain branches when the row is not gated', () => {
    const body = eq('x^2+y^2', '4');
    expect(gatedConicBranches(body, body)![0].fn(0)).not.toBeNull();
  });
});
