import { describe, it, expect } from 'vitest';
import { computePieces, sliceArea } from './solid-integrand';
import type { SolidCurve, SolidSpec } from './solid.types';

function curve(fn: (t: number) => number, label = 'f'): SolidCurve {
  return { fn, ast: null, label, color: '#000' };
}

describe('computePieces', () => {
  it('returns a single piece for one curve (disk-washer), curve above the axis', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    expect(pieces).toEqual([{ a: 0, b: 1, upperIndex: 0, lowerIndex: null }]);
  });

  it('puts the curve as the lower boundary when it is below the axis', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => -x - 1)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    expect(pieces).toEqual([{ a: 0, b: 1, upperIndex: null, lowerIndex: 0 }]);
  });

  it('does not split a single curve at crossings with the axis', () => {
    // y = x - 0.5 crosses the x-axis at x = 0.5, but per the contract this
    // split is not needed for a single-curve disk-washer piece.
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x - 0.5)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    expect(computePieces(spec)).toHaveLength(1);
  });

  it('returns one piece for two curves that only meet at the domain endpoints', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x, 'f1'), curve((x) => x * x, 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    expect(pieces).toEqual([{ a: 0, b: 1, upperIndex: 0, lowerIndex: 1 }]);
  });

  it('splits at an interior crossing and swaps upper/lower (spec 17 scenario)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x, 'f1'), curve((x) => x * x, 'f2')],
      a: 0,
      b: 2,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].a).toBeCloseTo(0, 6);
    expect(pieces[0].b).toBeCloseTo(1, 6);
    expect(pieces[0].upperIndex).toBe(0); // x > x^2 on (0,1)
    expect(pieces[0].lowerIndex).toBe(1);
    expect(pieces[1].a).toBeCloseTo(1, 6);
    expect(pieces[1].b).toBeCloseTo(2, 6);
    expect(pieces[1].upperIndex).toBe(1); // x^2 > x on (1,2)
    expect(pieces[1].lowerIndex).toBe(0);
  });

  it('builds a 3-curve envelope on [0,1]: upper x, lower x^3, x^2 dominated in between', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x, 'f1'), curve((x) => x * x, 'f2'), curve((x) => x ** 3, 'f3')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    // x >= x^2 >= x^3 on [0,1] (all equal only at the endpoints), so no interior crossings.
    expect(pieces).toHaveLength(1);
    expect(pieces[0].upperIndex).toBe(0);
    expect(pieces[0].lowerIndex).toBe(2);
  });

  it('splits a 3-curve envelope at three distinct pairwise crossings', () => {
    // f1 = x (rising), f2 = 1 - x (falling, crosses f1 at 0.5), f3 = 0.3 (constant,
    // crosses f1 at 0.3 and f2 at 0.7) - four pieces, envelope well-defined throughout.
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x, 'f1'), curve((x) => 1 - x, 'f2'), curve(() => 0.3, 'f3')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    expect(pieces).toHaveLength(4);
    for (const p of pieces) {
      expect(p.upperIndex).not.toBeNull();
      expect(p.lowerIndex).not.toBeNull();
      expect(p.upperIndex).not.toBe(p.lowerIndex);
    }
    expect(pieces[0].upperIndex).toBe(1); // (0, 0.3): f2 highest
    expect(pieces[0].lowerIndex).toBe(0);
    expect(pieces[1].lowerIndex).toBe(2); // (0.3, 0.5): f3 lowest
    expect(pieces[2].lowerIndex).toBe(2); // (0.5, 0.7): f3 still lowest
    expect(pieces[3].upperIndex).toBe(0); // (0.7, 1): f1 highest
    expect(pieces[3].lowerIndex).toBe(1);
  });

  it('splits a shell piece at the axis when k lies strictly inside (a, b)', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((x) => x * x)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0.5 },
    };
    const pieces = computePieces(spec);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].a).toBeCloseTo(0, 10);
    expect(pieces[0].b).toBeCloseTo(0.5, 10);
    expect(pieces[1].a).toBeCloseTo(0.5, 10);
    expect(pieces[1].b).toBeCloseTo(1, 10);
    // Same curve is upper on both sides of the split (y = x^2 >= 0 baseline throughout).
    expect(pieces[0].upperIndex).toBe(0);
    expect(pieces[1].upperIndex).toBe(0);
  });

  it('does not split a shell piece when the axis is outside (a, b)', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((x) => x * x)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    expect(computePieces(spec)).toHaveLength(1);
  });
});

describe('sliceArea', () => {
  it('computes the disk area π(f-k)² for a single curve', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = sliceArea(spec, computePieces(spec));
    expect(area(0.5)).toBeCloseTo(Math.PI * 0.25, 10);
  });

  it('computes the washer area π(R²-r²) for two curves, axis outside the region', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x, 'f1'), curve((x) => x * x, 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = sliceArea(spec, computePieces(spec));
    const t = 0.5;
    expect(area(t)).toBeCloseTo(Math.PI * (t * t - t ** 4), 10);
  });

  it('treats the axis-inside-region case as r = 0 (documented union behaviour)', () => {
    // On (0, 1): U = 1 (constant), L = x - 1 (negative), axis k = 0 sits
    // strictly between L and U for every t, so r should collapse to 0.
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve(() => 1, 'f1'), curve((x) => x - 1, 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = sliceArea(spec, computePieces(spec));
    const t = 0.5;
    const R = Math.max(Math.abs(1 - 0), Math.abs(t - 1 - 0));
    expect(area(t)).toBeCloseTo(Math.PI * R * R, 10);
  });

  it('computes the shell lateral area 2π|t-k|(U-L) for a single curve', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((x) => x * x)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    const area = sliceArea(spec, computePieces(spec));
    const t = 0.5;
    expect(area(t)).toBeCloseTo(2 * Math.PI * Math.abs(t - 2) * (t * t), 10);
  });

  it.each([
    ['square', (s: number) => s * s],
    ['rectangle', (s: number) => 3 * s * s],
    ['equilateral-triangle', (s: number) => (Math.sqrt(3) / 4) * s * s],
    ['right-isosceles-leg', (s: number) => (s * s) / 2],
    ['right-isosceles-hypotenuse', (s: number) => (s * s) / 4],
    ['semicircle', (s: number) => (Math.PI / 8) * s * s],
  ] as const)('computes the %s cross-section area', (shape, expectedFromWidth) => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curve((x) => Math.sqrt(1 - x * x), 'f1'), curve((x) => -Math.sqrt(1 - x * x), 'f2')],
      a: -1,
      b: 1,
      shape,
      heightRatio: shape === 'rectangle' ? 3 : undefined,
    };
    const area = sliceArea(spec, computePieces(spec));
    const t = 0.3;
    const s = 2 * Math.sqrt(1 - t * t);
    expect(area(t)).toBeCloseTo(expectedFromWidth(s), 10);
  });
});
