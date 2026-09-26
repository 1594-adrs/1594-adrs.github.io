import { describe, it, expect } from 'vitest';
import { computeSurfaceArea } from './solid-surface';
import { computePieces } from './solid-integrand';
import type { SolidCurve, SolidSpec } from './solid.types';

function curve(fn: (t: number) => number, label = 'f1'): SolidCurve {
  return { fn, ast: null, label, color: '#000' };
}

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
}

describe('computeSurfaceArea', () => {
  it('sphere: y=sqrt(1-x^2) on [-1,1] about y=0 -> 4pi', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => Math.sqrt(1 - x * x))],
      a: -1,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = computeSurfaceArea(spec, computePieces(spec));
    expect(area).not.toBeNull();
    expect(relErr(area!, 4 * Math.PI)).toBeLessThanOrEqual(1e-9);
  });

  it('cone: y=x on [0,1] about y=0 -> pi(1+sqrt2)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = computeSurfaceArea(spec, computePieces(spec));
    expect(area).not.toBeNull();
    expect(relErr(area!, Math.PI * (1 + Math.SQRT2))).toBeLessThanOrEqual(1e-6);
  });

  it('cylinder: y=1 on [0,2] about y=0 -> 6pi', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve(() => 1)],
      a: 0,
      b: 2,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = computeSurfaceArea(spec, computePieces(spec));
    expect(area).not.toBeNull();
    expect(relErr(area!, 6 * Math.PI)).toBeLessThanOrEqual(1e-6);
  });

  it('shell: y=x^2 on [0,1] about x=0 -> pi(5sqrt5-1)/6 + 3pi', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((x) => x * x)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    };
    const area = computeSurfaceArea(spec, computePieces(spec));
    expect(area).not.toBeNull();
    const expected = (Math.PI * (5 * Math.sqrt(5) - 1)) / 6 + 3 * Math.PI;
    expect(relErr(area!, expected)).toBeLessThanOrEqual(1e-6);
  });

  // Hand calculation (documented, no closed form recognised): the region is bounded above by
  // y=x and below by y=x^2 on [0,1] (they meet exactly at x=0 and x=1, so the end segments at
  // both bounds have U=L and contribute 0 - only the two curve arcs count).
  // arc(y=x): r=x, ds=sqrt(2)dx -> 2*pi*sqrt(2)*[x^2/2]_0^1 = pi*sqrt(2).
  // arc(y=x^2): r=x^2, ds=sqrt(1+4x^2)dx -> 2*pi*Integral(x^2*sqrt(1+4x^2), 0, 1)
  //   ~= 2*pi*0.6063373143721491 (Simpson's rule, 2e5 panels) ~= 3.809729704857817.
  // total ~= 4.442882938158366 + 3.809729704857817 = 8.252612643016183.
  it('washer: y=x & y=x^2 on [0,1] about y=0 -> ~8.2526126 (hand-checked, no closed form)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x, 'f1'), curve((x) => x * x, 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const area = computeSurfaceArea(spec, computePieces(spec));
    expect(area).not.toBeNull();
    expect(relErr(area!, 8.252612643016183)).toBeLessThanOrEqual(1e-6);
  });

  it('cross-section: always null', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curve((x) => Math.sqrt(1 - x * x), 'f1'), curve((x) => -Math.sqrt(1 - x * x), 'f2')],
      a: -1,
      b: 1,
      shape: 'square',
    };
    expect(computeSurfaceArea(spec, computePieces(spec))).toBeNull();
  });

  it('returns null when the axis cuts the region (disk-washer)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => 1), curve((x) => x - 1)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    expect(computeSurfaceArea(spec, computePieces(spec))).toBeNull();
  });

  it('returns null when the shell axis lies strictly inside the domain', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((x) => x * x)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0.5 },
    };
    expect(computeSurfaceArea(spec, computePieces(spec))).toBeNull();
  });

  it('returns null without an axis', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((x) => x)],
      a: 0,
      b: 1,
    };
    expect(computeSurfaceArea(spec, computePieces(spec))).toBeNull();
  });
});
