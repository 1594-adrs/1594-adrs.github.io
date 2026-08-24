import * as THREE from 'three';
import type { RotationAxis } from '../../models/calculator.models';

export function generateRevolutionMesh(
  fn: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis,
  segments = 64,
  radialSegments = 32,
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const h = (b - a) / radialSegments;

  for (let i = 0; i <= radialSegments; i++) {
    const x = a + i * h;
    let y: number;
    try {
      y = fn(x);
    } catch {
      y = 0;
    }
    if (!isFinite(y)) y = 0;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      let vx: number, vy: number, vz: number;
      let nx: number, ny: number, nz: number;

      if (axis.type === 'x') {
        const k = axis.value;
        vx = x;
        vy = y * cos + k * (1 - cos);
        vz = y * sin;
        nx = 0;
        ny = cos;
        nz = sin;
      } else {
        const k = axis.value;
        const r = x - k;
        vx = k + r * cos;
        vy = y;
        vz = r * sin;
        nx = cos;
        ny = 0;
        nz = sin;
      }

      vertices.push(vx, vy, vz);
      normals.push(nx, ny, nz);
    }
  }

  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}
