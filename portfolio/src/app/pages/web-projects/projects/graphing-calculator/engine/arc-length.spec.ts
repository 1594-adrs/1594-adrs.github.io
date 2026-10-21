import { describe, expect, it } from 'vitest';
import { arcLength, lateralSurface, type ArcCurve } from './arc-length';
import { parse } from './parser';

const PI = Math.PI;
const explicit = (f: string): ArcCurve => ({ mode: 'explicit', f: parse(f) });

describe('arcLength', () => {
  it('measures a line, a circle (parametric and polar) and x = g(y)', () => {
    expect(arcLength(explicit('3*x/4'), 0, 4).value).toBeCloseTo(5, 10);
    const circle: ArcCurve = { mode: 'parametric', x: parse('2*cos(t)'), y: parse('2*sin(t)') };
    expect(arcLength(circle, 0, 2 * PI).value).toBeCloseTo(4 * PI, 9);
    expect(arcLength({ mode: 'polar', r: parse('2') }, 0, PI).value).toBeCloseTo(2 * PI, 9);
    expect(arcLength({ mode: 'explicit-y', g: parse('y^2/2') }, 0, 1).value).toBeCloseTo(
      (Math.SQRT2 + Math.asinh(1)) / 2,
      9,
    );
  });

  it('reads x as the parameter in a parametric row; the cardioid has length 8', () => {
    const c: ArcCurve = { mode: 'parametric', x: parse('x^2'), y: parse('x^3') };
    // integral of t*sqrt(4 + 9t^2) on [0, 1] = (13*sqrt(13) - 8)/27
    expect(arcLength(c, 0, 1).value).toBeCloseTo((13 * Math.sqrt(13) - 8) / 27, 9);
    expect(arcLength({ mode: 'polar', r: parse('1+cos(t)') }, 0, 2 * PI).value).toBeCloseTo(8, 8);
  });

  it('integrates an integrable singular slope (x^(3/2)/3 - sqrt(x) at 0)', () => {
    // ds = (sqrt(x) + 1/sqrt(x))/2 dx, so L = 4^(3/2)/3 + sqrt(4) = 14/3
    const r = arcLength(explicit('x^(3/2)/3 - sqrt(x)'), 0, 4);
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(14 / 3, 6);
  });

  it('reports a curve undefined on the interval instead of a number', () => {
    expect(arcLength(explicit('sqrt(x)'), -2, -1).status).toBe('undefined');
  });
});

describe('lateralSurface', () => {
  it('sphere 4*pi*R^2 from y = sqrt(R^2 - x^2) about the x-axis', () => {
    const axis = { orientation: 'horizontal', value: 0 } as const;
    expect(lateralSurface(explicit('sqrt(9 - x^2)'), -3, 3, axis).value).toBeCloseTo(36 * PI, 5);
  });

  it('the same cone about the y-axis from y = f(x), x = g(y) and parametric rows', () => {
    const want = PI * Math.SQRT2; // radius 1, slant sqrt(2)
    const axisY = { orientation: 'vertical', value: 0 } as const;
    expect(lateralSurface(explicit('x'), 0, 1, axisY).value).toBeCloseTo(want, 9);
    const g: ArcCurve = { mode: 'explicit-y', g: parse('y') };
    expect(lateralSurface(g, 0, 1, axisY).value).toBeCloseTo(want, 9);
    const p: ArcCurve = { mode: 'parametric', x: parse('t'), y: parse('t') };
    expect(lateralSurface(p, 0, 1, axisY).value).toBeCloseTo(want, 9);
  });

  it('uses the distance to a shifted axis; polar r = 2 on [0, pi] gives the sphere', () => {
    // y = 1 about y = -1 over [0, 2]: a cylinder of radius 2 and height 2
    const r = lateralSurface(explicit('1'), 0, 2, { orientation: 'horizontal', value: -1 });
    expect(r.value).toBeCloseTo(8 * PI, 9);
    const sphere = lateralSurface({ mode: 'polar', r: parse('2') }, 0, PI, {
      orientation: 'horizontal',
      value: 0,
    });
    expect(sphere.value).toBeCloseTo(16 * PI, 8);
  });
});
