import { describe, expect, it } from 'vitest';
import { computeCentroid } from './centroid';

describe('computeCentroid', () => {
  it('triangle under y = x on [0, 1] (one curve: bounded by the axis)', () => {
    const c = computeCentroid([(x) => x], 0, 1);
    expect(c.status).toBe('ok');
    expect(c.area).toBeCloseTo(0.5, 10);
    expect(c.x).toBeCloseTo(2 / 3, 10);
    expect(c.y).toBeCloseTo(1 / 3, 10);
  });

  it('between y = x and y = x^2 (top/bottom from the area envelope)', () => {
    const c = computeCentroid([(x) => x * x, (x) => x], 0, 1);
    expect(c.x).toBeCloseTo(0.5, 9);
    expect(c.y).toBeCloseTo(0.4, 9);
  });

  it("variable 'y' swaps the coordinates (x = y and x = y^2: the mirrored region)", () => {
    const c = computeCentroid([(y) => y * y, (y) => y], 0, 1, 'y');
    expect(c.x).toBeCloseTo(0.4, 9);
    expect(c.y).toBeCloseTo(0.5, 9);
  });

  it('a region that crosses the axis splits there (absolute area, signed moments)', () => {
    const c = computeCentroid([(x) => x], -1, 1);
    expect(c.area).toBeCloseTo(1, 10);
    expect(c.x).toBeCloseTo(0, 10);
    expect(c.y).toBeCloseTo(0, 10);
  });

  it('a divergent region gives no centroid', () => {
    const c = computeCentroid([(x) => 1 / x], 0, 1);
    expect(c.status).toBe('divergent');
    expect(c.x).toBeNaN();
  });
});
