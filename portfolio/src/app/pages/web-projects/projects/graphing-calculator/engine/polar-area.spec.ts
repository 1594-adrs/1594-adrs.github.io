import { describe, expect, it } from 'vitest';
import { polarArea } from './polar-area';

const PI = Math.PI;

describe('polarArea', () => {
  it('one curve is (1/2) integral of r^2 (cardioid 3pi/2; a circle traced twice counts twice)', () => {
    expect(polarArea([(t) => 1 + Math.cos(t)], 0, 2 * PI).value).toBeCloseTo(1.5 * PI, 9);
    expect(polarArea([(t) => 2 * Math.cos(t)], 0, 2 * PI).value).toBeCloseTo(2 * PI, 9);
  });

  it('two nested curves: the region between them', () => {
    const r = polarArea([() => 2, () => 1], 0, 2 * PI);
    expect(r.region).toBe('between');
    expect(r.value).toBeCloseTo(3 * PI, 8);
  });

  it('two crossing curves: the common interior (r = cos t, r = sin t gives (pi - 2)/8)', () => {
    const lens = polarArea([(t) => Math.cos(t), (t) => Math.sin(t)], 0, 2 * PI);
    expect(lens.region).toBe('common');
    expect(lens.value).toBeCloseTo((PI - 2) / 8, 7);
  });

  it('restricted bounds: inside r = 3 sin t, outside r = 1 + sin t on [pi/6, 5pi/6] is pi', () => {
    const r = polarArea([(t) => 3 * Math.sin(t), (t) => 1 + Math.sin(t)], PI / 6, (5 * PI) / 6);
    expect(r.region).toBe('between');
    expect(r.value).toBeCloseTo(PI, 7);
  });

  it('a curve with an inner loop has no single radius per direction: unsupported', () => {
    const r = polarArea([(t) => 1 + 2 * Math.sin(t), () => 4], 0, 2 * PI);
    expect(r.status).toBe('unsupported');
    expect(r.value).toBeNaN();
  });
});
