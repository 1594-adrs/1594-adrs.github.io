import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { buildLoft } from './loft';

function square(z: number, size = 1): Vector3[] {
  return [
    new Vector3(0, 0, z),
    new Vector3(size, 0, z),
    new Vector3(size, size, z),
    new Vector3(0, size, z),
  ];
}

function triangle(z: number): Vector3[] {
  return [new Vector3(0, 0, z), new Vector3(1, 0, z), new Vector3(0.5, 1, z)];
}

describe('buildLoft', () => {
  it('returns null with fewer than 2 profiles', () => {
    expect(buildLoft([square(0)])).toBeNull();
  });

  it('returns null when a profile has fewer than 3 vertices', () => {
    expect(
      buildLoft([
        [new Vector3(0, 0, 0), new Vector3(1, 0, 0)],
        [new Vector3(0, 0, 1), new Vector3(1, 0, 1)],
      ]),
    ).toBeNull();
  });

  it('returns null when profiles have mismatched vertex counts', () => {
    expect(buildLoft([square(0), triangle(1)])).toBeNull();
  });

  it('produces the expected vertex and index counts for two square rings', () => {
    const geometry = buildLoft([square(0), square(1)])!;
    expect(geometry).not.toBeNull();

    const n = 4;
    const rings = 2;
    expect(geometry.getAttribute('position').count).toBe(n * rings);

    const sideTriangles = (rings - 1) * n * 2;
    const capTriangles = 2 * (n - 2);
    const expectedIndices = (sideTriangles + capTriangles) * 3;
    expect(geometry.getIndex()?.count).toBe(expectedIndices);
  });

  it('closes the mesh: every edge of the side walls is shared by exactly two triangles', () => {
    const geometry = buildLoft([square(0), square(1), square(2)])!;
    const index = geometry.getIndex()!;
    const edgeCounts = new Map<string, number>();
    for (let i = 0; i < index.count; i += 3) {
      const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }
    for (const count of edgeCounts.values()) {
      expect(count).toBe(2);
    }
  });

  it('scales to a triangular profile with a 3-vertex fan cap (1 triangle per cap)', () => {
    const geometry = buildLoft([triangle(0), triangle(1)])!;
    const n = 3;
    const rings = 2;
    const sideTriangles = (rings - 1) * n * 2;
    const capTriangles = 2 * (n - 2); // 1 triangle per cap for a triangle profile
    expect(geometry.getIndex()?.count).toBe((sideTriangles + capTriangles) * 3);
  });
});
