import { describe, it, expect } from 'vitest';
import { formatValue } from './format-value';
import {
  conicInfoLines,
  describeIntegral,
  areaLabel,
  areaLimitNotes,
  limitErrorMessage,
  regionAreaText,
  sumRegions,
  tableToCsv,
  type RegionLike,
} from './result-format';

const region = (over: Partial<RegionLike>): RegionLike => ({
  a: 0,
  b: 1,
  area: 1,
  status: 'ok',
  topFunctionIndex: 0,
  bottomFunctionIndex: 1,
  ...over,
});

describe('formatValue', () => {
  it('trims trailing zeros and uses one vocabulary', () => {
    expect(formatValue(2)).toBe('2');
    expect(formatValue(1.5)).toBe('1.5');
    expect(formatValue(Math.PI)).toBe('3.141593');
    expect(formatValue(NaN)).toBe('undefined');
    expect(formatValue(Infinity)).toBe('∞');
    expect(formatValue(-Infinity)).toBe('-∞');
    expect(formatValue(1e-12)).toBe('0');
    expect(formatValue(1e13)).toBe('1.000e+13');
  });
});

describe('describeIntegral', () => {
  const ok = { value: 2, error: 0, status: 'ok' as const };
  it('puts the limits in the label and warns for reversed and empty intervals', () => {
    expect(describeIntegral('sin(x)', 0, 3, ok)[0].label).toContain('[0, 3]');
    expect(describeIntegral('x', 3, 0, ok)[0].notes?.[0]).toContain('reversed');
    expect(describeIntegral('x', 1, 1, ok)[0].notes?.[0]).toContain('empty');
  });
  it('marks inaccurate results as approximate and divergent ones as such', () => {
    const inacc = describeIntegral('f', 0, 1, { value: 1, error: 0.01, status: 'inaccurate' })[0];
    expect(inacc.approx).toBe(true);
    expect(inacc.error).toBe('± 0.01');
    const div = describeIntegral('1/x', -1, 1, { value: Infinity, error: 0, status: 'divergent' });
    expect(div[0].value).toBe('divergent');
    expect(div.length).toBe(1);
  });
  it('adds a total-area row when given', () => {
    expect(describeIntegral('x', 0, 1, ok, 4).map((r) => r.value)).toEqual(['2', '4']);
  });
});

describe('sumRegions', () => {
  it('sums finite regions', () => {
    expect(sumRegions([region({ area: 1 }), region({ area: 2.5 })])).toEqual({
      status: 'ok',
      value: 3.5,
    });
  });
  it('propagates divergent over undefined', () => {
    const regions = [
      region({ area: NaN, status: 'undefined' }),
      region({ area: Infinity, status: 'divergent' }),
    ];
    expect(sumRegions(regions).status).toBe('divergent');
    expect(sumRegions([region({ area: NaN, status: 'undefined' })]).status).toBe('undefined');
  });
  it('texts for regions', () => {
    expect(regionAreaText(region({ area: Infinity, status: 'divergent' }))).toBe('divergent');
    expect(regionAreaText(region({ area: 2, status: 'inaccurate' }))).toBe('≈ 2');
  });
});

describe('limitErrorMessage / tableToCsv', () => {
  it('returns a message only when invalid', () => {
    expect(limitErrorMessage(false)).toBeNull();
    expect(limitErrorMessage(true)).toContain('Enter a number');
  });
  it('serialises CSV with quoting', () => {
    expect(tableToCsv(['x', 'f(x)'], [{ input: '1', output: '2' }])).toBe('x,f(x)\n1,2');
    expect(tableToCsv(['x', 'y'], [{ input: 'a,b', output: '"q"' }])).toBe('x,y\n"a,b","""q"""');
  });
});

describe('conicInfoLines', () => {
  it('lists only the fields present', () => {
    const lines = conicInfoLines({
      type: 'circle',
      center: { x: 0, y: 1 },
      radius: 2,
      equation: 'x^2+(y-1)^2=4',
    });
    expect(lines.map((l) => l.label)).toEqual(['Type', 'Center', 'Radius']);
    expect(lines[1].value).toBe('(0, 1)');
  });
});

describe('area label and limit notes', () => {
  it('includes limits and curve names', () => {
    expect(areaLabel(0, 1, ['f1', 'f2'])).toBe('A [0, 1]: f1, f2');
  });
  it('explains reversed and empty intervals, nothing otherwise', () => {
    expect(areaLimitNotes(3, 0)[0]).toContain('reversed');
    expect(areaLimitNotes(1, 1)[0]).toContain('empty');
    expect(areaLimitNotes(0, 1)).toEqual([]);
  });
});
