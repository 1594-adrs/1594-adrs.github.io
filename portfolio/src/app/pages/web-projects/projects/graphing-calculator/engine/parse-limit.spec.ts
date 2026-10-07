import { parseLimitText } from './parse-limit';

describe('parseLimitText', () => {
  it.each([
    ['2', 2],
    ['-1.5', -1.5],
    ['1e3', 1000],
    ['pi/2', Math.PI / 2],
    ['2*pi', 2 * Math.PI],
    ['((1)/(3))', 1 / 3],
  ])('parses %s', (text, expected) => {
    const r = parseLimitText(text);
    expect(r.invalid).toBe(false);
    expect(r.value).toBeCloseTo(expected, 10);
  });

  it('treats empty text as unset, not invalid', () => {
    expect(parseLimitText('  ')).toEqual({ value: null, invalid: false });
  });

  it.each(['pi/', 'abc', '2*'])('flags %s as invalid', (text) => {
    expect(parseLimitText(text)).toEqual({ value: null, invalid: true });
  });
});
