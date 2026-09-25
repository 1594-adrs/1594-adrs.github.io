import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/**
 * Generic loft: connects a sequence of same-size polygon "rings" (profiles) into a single
 * closed mesh (side walls between consecutive rings + triangulated end caps).
 *
 * Each profile is an implicitly-closed polygon: vertex `n-1` connects back to vertex `0`.
 * Caps are triangulated as a fan from vertex 0, which is correct for the convex/near-convex
 * cross-section shapes this feature uses (square, rectangle, triangles, semicircle).
 *
 * Returns null when there are fewer than 2 profiles, a profile has fewer than 3 vertices, or
 * profiles don't share the same vertex count (the caller must sample a fixed-shape family).
 */
export function buildLoft(profiles: Vector3[][]): BufferGeometry | null {
  if (profiles.length < 2) return null;
  const n = profiles[0].length;
  if (n < 3) return null;
  for (const profile of profiles) {
    if (profile.length !== n) return null;
  }

  const positions: number[] = [];
  for (const profile of profiles) {
    for (const v of profile) positions.push(v.x, v.y, v.z);
  }

  const indices: number[] = [];
  const rings = profiles.length;

  // side walls
  for (let i = 0; i < rings - 1; i++) {
    const base = i * n;
    const next = (i + 1) * n;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = base + j;
      const b = base + j1;
      const c = next + j;
      const d = next + j1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // start cap (fan from vertex 0), reversed winding so it faces away from the loft
  for (let k = 1; k < n - 1; k++) {
    indices.push(0, k + 1, k);
  }

  // end cap (fan from vertex 0 of the last ring)
  const endBase = (rings - 1) * n;
  for (let k = 1; k < n - 1; k++) {
    indices.push(endBase, endBase + k, endBase + k + 1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
