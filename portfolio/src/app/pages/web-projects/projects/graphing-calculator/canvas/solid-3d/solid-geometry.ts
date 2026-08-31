import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { RotationAxis } from '../../models/calculator.models';
import type { SolidRegion } from '../../engine/calculus';

function tryEvalFn(fn: (x: number) => number, x: number): number {
  try {
    const y = fn(x);
    return isFinite(y) ? y : 0;
  } catch {
    return 0;
  }
}

export function generateRevolutionMeshMulti(
  functions: Array<(x: number) => number>,
  regions: SolidRegion[],
  axis: RotationAxis,
  segments = 64,
  radialSegments = 32,
): BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const region of regions) {
    if (region.b - region.a < 1e-12) continue;
    const topFn = functions[region.topFunctionIndex];
    const botFn = functions[region.bottomFunctionIndex];
    const isSingleFn = region.topFunctionIndex === region.bottomFunctionIndex;
    const h = (region.b - region.a) / radialSegments;
    const baseIdx = vertices.length / 3;

    const k = axis.value;

    for (let i = 0; i <= radialSegments; i++) {
      const x = region.a + i * h;
      const outerY = tryEvalFn(topFn, x);
      const innerY = isSingleFn ? k : tryEvalFn(botFn, x);

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        let ovx: number, ovy: number, ovz: number;

        if (axis.type === 'x') {
          ovx = x;
          ovy = outerY * cos + k * (1 - cos);
          ovz = outerY * sin;
        } else {
          const r = x - k;
          ovx = k + r * cos;
          ovy = outerY;
          ovz = r * sin;
        }

        vertices.push(ovx, ovy, ovz);
        if (axis.type === 'x') {
          normals.push(0, cos, sin);
        } else {
          normals.push(cos, 0, sin);
        }

        if (!isSingleFn) {
          let ivx: number, ivy: number, ivz: number;
          if (axis.type === 'x') {
            ivx = x;
            ivy = innerY * cos + k * (1 - cos);
            ivz = innerY * sin;
          } else {
            const r = x - k;
            ivx = k + r * cos;
            ivy = innerY;
            ivz = r * sin;
          }
          vertices.push(ivx, ivy, ivz);
          if (axis.type === 'x') {
            normals.push(0, -cos, -sin);
          } else {
            normals.push(-cos, 0, -sin);
          }
        }
      }
    }

    const vertsPerRow = isSingleFn ? (segments + 1) : (segments + 1) * 2;

    for (let i = 0; i < radialSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = baseIdx + i * vertsPerRow + j * (isSingleFn ? 1 : 2);
        const b = a + vertsPerRow;

        if (isSingleFn) {
          indices.push(a, b, a + 1);
          indices.push(b, b + 1, a + 1);
        } else {
          const outerA = a;
          const outerB = b;
          const innerA = a + 1;
          const innerB = b + 1;

          indices.push(outerA, outerB, outerA + 2);
          indices.push(outerB, outerB + 2, outerA + 2);
          indices.push(innerA, innerA + 2, innerB);
          indices.push(innerB, innerA + 2, innerB + 2);
        }
      }
    }

    const capCenter = vertices.length / 3;
    const topY = tryEvalFn(topFn, region.a);
    if (axis.type === 'x') {
      vertices.push(region.a, k, 0);
      normals.push(-1, 0, 0);
    } else {
      vertices.push(region.a, k, 0);
      normals.push(0, 0, -1);
    }
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      if (axis.type === 'x') {
        vertices.push(region.a, topY * cos + k * (1 - cos), topY * sin);
        normals.push(-1, 0, 0);
        if (!isSingleFn) {
          const botY = tryEvalFn(botFn, region.a);
          vertices.push(region.a, botY * cos + k * (1 - cos), botY * sin);
          normals.push(-1, 0, 0);
        }
      } else {
        const r = region.a - k;
        vertices.push(k + r * cos, topY, r * sin);
        normals.push(0, 0, -1);
        if (!isSingleFn) {
          const botY = tryEvalFn(botFn, region.a);
          vertices.push(k + r * cos, botY, r * sin);
          normals.push(0, 0, -1);
        }
      }
    }

    const capVertsPerRow = isSingleFn ? 1 : 2;
    for (let j = 0; j < segments; j++) {
      const a = capCenter + 1 + j * capVertsPerRow;
      if (isSingleFn) {
        indices.push(capCenter, a, a + 1);
      } else {
        const innerA = a + 1;
        indices.push(capCenter, a, innerA);
        indices.push(capCenter, innerA, capCenter + 1 + (j + 1) * capVertsPerRow);
        indices.push(capCenter, capCenter + 1 + (j + 1) * capVertsPerRow, capCenter + 1 + (j + 1) * capVertsPerRow + 1);
      }
    }

    const botCapCenter = vertices.length / 3;
    const topYb = tryEvalFn(topFn, region.b);
    if (axis.type === 'x') {
      vertices.push(region.b, k, 0);
      normals.push(1, 0, 0);
    } else {
      vertices.push(region.b, k, 0);
      normals.push(0, 0, 1);
    }
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      if (axis.type === 'x') {
        vertices.push(region.b, topYb * cos + k * (1 - cos), topYb * sin);
        normals.push(1, 0, 0);
        if (!isSingleFn) {
          const botYb = tryEvalFn(botFn, region.b);
          vertices.push(region.b, botYb * cos + k * (1 - cos), botYb * sin);
          normals.push(1, 0, 0);
        }
      } else {
        const r = region.b - k;
        vertices.push(k + r * cos, topYb, r * sin);
        normals.push(0, 0, 1);
        if (!isSingleFn) {
          const botYb = tryEvalFn(botFn, region.b);
          vertices.push(k + r * cos, botYb, r * sin);
          normals.push(0, 0, 1);
        }
      }
    }

    for (let j = 0; j < segments; j++) {
      const a = botCapCenter + 1 + j * capVertsPerRow;
      if (isSingleFn) {
        indices.push(botCapCenter, a + 1, a);
      } else {
        const innerA = a + 1;
        indices.push(botCapCenter, innerA, a);
        indices.push(botCapCenter, botCapCenter + 1 + (j + 1) * capVertsPerRow + 1, innerA);
        indices.push(botCapCenter, botCapCenter + 1 + (j + 1) * capVertsPerRow, botCapCenter + 1 + (j + 1) * capVertsPerRow + 1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}
