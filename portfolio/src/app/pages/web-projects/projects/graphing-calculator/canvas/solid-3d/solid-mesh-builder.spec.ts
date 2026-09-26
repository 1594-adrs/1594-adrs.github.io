import { describe, it, expect } from 'vitest';
import { Box3, BufferGeometry, Vector3 } from 'three';
import { buildSolidGeometry } from './solid-mesh-builder';
import type { SolidCurve, SolidPiece, SolidSpec } from '../../engine/solids/solid.types';

function curve(fn: (t: number) => number, label = 'f'): SolidCurve {
  return { fn, ast: null, label, color: '#00ff88' };
}

function boundsOf(geometries: BufferGeometry[]): Box3 {
  const box = new Box3();
  for (const g of geometries) {
    g.computeBoundingBox();
    if (g.boundingBox) box.union(g.boundingBox);
  }
  return box;
}

function maxRadiusXZ(
  geometries: BufferGeometry[],
  center: { x?: number; z?: number } = {},
): number {
  const cx = center.x ?? 0;
  const cz = center.z ?? 0;
  let max = 0;
  for (const g of geometries) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - cx;
      const dz = pos.getZ(i) - cz;
      max = Math.max(max, Math.hypot(dx, dz));
    }
  }
  return max;
}

function maxRadiusYZ(
  geometries: BufferGeometry[],
  center: { y?: number; z?: number } = {},
): number {
  const cy = center.y ?? 0;
  const cz = center.z ?? 0;
  let max = 0;
  for (const g of geometries) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const dy = pos.getY(i) - cy;
      const dz = pos.getZ(i) - cz;
      max = Math.max(max, Math.hypot(dy, dz));
    }
  }
  return max;
}

function minRadiusYZ(
  geometries: BufferGeometry[],
  center: { y?: number; z?: number } = {},
): number {
  const cy = center.y ?? 0;
  const cz = center.z ?? 0;
  let min = Infinity;
  for (const g of geometries) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const dy = pos.getY(i) - cy;
      const dz = pos.getZ(i) - cz;
      min = Math.min(min, Math.hypot(dy, dz));
    }
  }
  return min;
}

describe('buildSolidGeometry — revolution (disk-washer)', () => {
  it('y=1 on [0,2] about the x-axis (y=0): cylinder radius 1, length 2', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve(() => 1)],
      a: 0,
      b: 2,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces: SolidPiece[] = [{ a: 0, b: 2, upperIndex: 0, lowerIndex: null }];
    const geometries = buildSolidGeometry(spec, pieces);
    expect(geometries.length).toBe(1);

    const box = boundsOf(geometries);
    expect(box.min.x).toBeCloseTo(0, 5);
    expect(box.max.x).toBeCloseTo(2, 5);
    expect(maxRadiusYZ(geometries, { y: 0 })).toBeCloseTo(1, 4);
  });

  it('y=x on [0,1] about y=-1 (horizontal): max radius 2', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curve((t) => t)],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: -1 },
    };
    const pieces: SolidPiece[] = [{ a: 0, b: 1, upperIndex: 0, lowerIndex: null }];
    const geometries = buildSolidGeometry(spec, pieces);
    expect(maxRadiusYZ(geometries, { y: -1 })).toBeCloseTo(2, 3);
  });
});

describe('buildSolidGeometry — revolution (shell)', () => {
  it('y=x^2 on [0,1] about the vertical line x=2: radii between 1 and 2', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curve((t) => t * t)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    const pieces: SolidPiece[] = [{ a: 0, b: 1, upperIndex: 0, lowerIndex: null }];
    const geometries = buildSolidGeometry(spec, pieces);
    const max = maxRadiusXZ(geometries, { x: 2 });
    const min = minRadiusXZ(geometries, { x: 2 });
    expect(max).toBeLessThanOrEqual(2 + 1e-6);
    expect(max).toBeGreaterThan(1.9);
    expect(min).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(min).toBeLessThan(1.1);
  });

  function minRadiusXZ(geometries: BufferGeometry[], center: { x?: number; z?: number }): number {
    const cx = center.x ?? 0;
    const cz = center.z ?? 0;
    let min = Infinity;
    for (const g of geometries) {
      const pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - cx;
        const dz = pos.getZ(i) - cz;
        min = Math.min(min, Math.hypot(dx, dz));
      }
    }
    return min;
  }
});

describe('buildSolidGeometry — revolution (variable y)', () => {
  it('x=g(y)=y^2 on y in [0,1] about the vertical line x=0: radius <= 1', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'y',
      curves: [curve((t) => t * t)],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    };
    const pieces: SolidPiece[] = [{ a: 0, b: 1, upperIndex: 0, lowerIndex: null }];
    const geometries = buildSolidGeometry(spec, pieces);
    expect(maxRadiusXZ(geometries, { x: 0 })).toBeLessThanOrEqual(1 + 1e-6);

    const box = boundsOf(geometries);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(1, 5);
  });
});

describe('buildSolidGeometry — cross-section', () => {
  it('square cross-sections between y=sqrt(1-x^2) and y=-sqrt(1-x^2) over [-1,1]: max height 2', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [
        curve((x) => Math.sqrt(Math.max(0, 1 - x * x))),
        curve((x) => -Math.sqrt(Math.max(0, 1 - x * x))),
      ],
      a: -1,
      b: 1,
      shape: 'square',
    };
    const pieces: SolidPiece[] = [{ a: -1, b: 1, upperIndex: 0, lowerIndex: 1 }];
    const geometries = buildSolidGeometry(spec, pieces);
    expect(geometries.length).toBe(1);
    const box = boundsOf(geometries);
    expect(box.max.z).toBeCloseTo(2, 1);
    expect(box.min.z).toBeCloseTo(0, 6);
  });

  it('semicircle cross-section rises to s/2 at its widest point', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curve(() => 1), curve(() => -1)],
      a: 0,
      b: 1,
      shape: 'semicircle',
    };
    const pieces: SolidPiece[] = [{ a: 0, b: 1, upperIndex: 0, lowerIndex: 1 }];
    const geometries = buildSolidGeometry(spec, pieces);
    const box = boundsOf(geometries);
    // s = upper - lower = 2 everywhere, so the semicircle bulge should reach s/2 = 1.
    expect(box.max.z).toBeCloseTo(1, 2);
  });
});
