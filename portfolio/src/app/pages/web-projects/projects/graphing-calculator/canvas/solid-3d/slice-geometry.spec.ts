import { describe, it, expect } from 'vitest';
import { buildSliceGeometry } from './slice-geometry';
import type { SolidCurve, SolidPiece, SolidSpec } from '../../engine/solids/solid.types';

function curve(fn: (t: number) => number, label = 'f'): SolidCurve {
  return { fn, ast: null, label, color: '#00ff88' };
}

const diskSpec: SolidSpec = {
  method: 'disk-washer',
  variable: 'x',
  curves: [curve(() => 1)],
  a: 0,
  b: 2,
  axis: { orientation: 'horizontal', value: 0 },
};
const diskPieces: SolidPiece[] = [{ a: 0, b: 2, upperIndex: 0, lowerIndex: null }];

describe('buildSliceGeometry', () => {
  it('returns null for t outside [a, b]', () => {
    expect(buildSliceGeometry(diskSpec, diskPieces, -1)).toBeNull();
    expect(buildSliceGeometry(diskSpec, diskPieces, 3)).toBeNull();
  });

  it('returns null for non-finite t', () => {
    expect(buildSliceGeometry(diskSpec, diskPieces, NaN)).toBeNull();
    expect(buildSliceGeometry(diskSpec, diskPieces, Infinity)).toBeNull();
  });

  it('returns a thin disk geometry for t inside [a, b]', () => {
    const geometry = buildSliceGeometry(diskSpec, diskPieces, 1);
    expect(geometry).not.toBeNull();
    geometry!.computeBoundingBox();
    const box = geometry!.boundingBox!;
    // thin along the axial (x) direction, full radius (~1) in y/z
    expect(box.max.x - box.min.x).toBeLessThan(0.2);
    expect(box.max.y - box.min.y).toBeGreaterThan(1.5);
  });

  it('returns a thin cylindrical shell for the shell method', () => {
    const shellSpec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((t) => t * t)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    const pieces: SolidPiece[] = [{ a: 0, b: 1, upperIndex: 0, lowerIndex: null }];
    const geometry = buildSliceGeometry(shellSpec, pieces, 0.5);
    expect(geometry).not.toBeNull();

    // thin in radius (distance from the vertical axis x=2): min and max radius nearly equal
    const pos = geometry!.getAttribute('position');
    let minR = Infinity;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i) - 2, pos.getZ(i));
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
    expect(maxR - minR).toBeLessThan(0.05);
    expect(maxR).toBeCloseTo(1.5, 1);

    // full height from baseline (0) to the curve value at t=0.5 (0.25), not thin
    geometry!.computeBoundingBox();
    const box = geometry!.boundingBox!;
    expect(box.max.y - box.min.y).toBeGreaterThan(0.2);
  });

  it('returns a thin prism for the cross-section method', () => {
    const crossSpec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curve(() => 1), curve(() => -1)],
      a: -1,
      b: 1,
      shape: 'square',
    };
    const pieces: SolidPiece[] = [{ a: -1, b: 1, upperIndex: 0, lowerIndex: 1 }];
    const geometry = buildSliceGeometry(crossSpec, pieces, 0);
    expect(geometry).not.toBeNull();
    geometry!.computeBoundingBox();
    const box = geometry!.boundingBox!;
    expect(box.max.x - box.min.x).toBeLessThan(0.2);
    expect(box.max.z).toBeCloseTo(2, 1); // square side = upper - lower = 2
  });
});
