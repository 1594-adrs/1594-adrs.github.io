import { tryEval, safeY } from './utils';

const CLAMP = 1e8;

describe('tryEval', () => {
  it('should return the normal value', () => {
    const fn = (x: number) => x * 2;
    expect(tryEval(fn, 5)).toBe(10);
  });

  it('should return NaN for NaN result', () => {
    const fn = (_x: number) => NaN;
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should return NaN for Infinity result', () => {
    const fn = (_x: number) => Infinity;
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should return NaN for negative Infinity result', () => {
    const fn = (_x: number) => -Infinity;
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should return NaN when function throws', () => {
    const fn = (_x: number) => {
      throw new Error('boom');
    };
    expect(tryEval(fn, 1)).toBeNaN();
  });

  it('should clamp large positive values to CLAMP', () => {
    const fn = (_x: number) => CLAMP + 1000;
    expect(tryEval(fn, 1)).toBe(CLAMP);
  });

  it('should clamp large negative values to -CLAMP', () => {
    const fn = (_x: number) => -(CLAMP + 1000);
    expect(tryEval(fn, 1)).toBe(-CLAMP);
  });

  it('should return values within range unchanged', () => {
    const fn = (_x: number) => 42;
    expect(tryEval(fn, 0)).toBe(42);
  });
});

describe('safeY', () => {
  it('should return the normal value', () => {
    expect(safeY(5)).toBe(5);
  });

  it('should return 0 for NaN', () => {
    expect(safeY(NaN)).toBe(0);
  });

  it('should return 0 for Infinity', () => {
    expect(safeY(Infinity)).toBe(0);
  });

  it('should return 0 for negative Infinity', () => {
    expect(safeY(-Infinity)).toBe(0);
  });

  it('should clamp large positive values to CLAMP', () => {
    expect(safeY(CLAMP + 1000)).toBe(CLAMP);
  });

  it('should clamp large negative values to -CLAMP', () => {
    expect(safeY(-(CLAMP + 1000))).toBe(-CLAMP);
  });

  it('should return values within range unchanged', () => {
    expect(safeY(-99999999)).toBe(-99999999);
    expect(safeY(0)).toBe(0);
  });
});
