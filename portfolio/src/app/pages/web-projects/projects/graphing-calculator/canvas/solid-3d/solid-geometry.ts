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

export interface SolidMeshes {
  outer: BufferGeometry;
  inner: BufferGeometry | null;
  caps: BufferGeometry;
}

export function generateRevolutionMeshMulti(
  functions: Array<(x: number) => number>,
  regions: SolidRegion[],
  axis: RotationAxis,
  segments = 64,
  radialSegments = 32,
): SolidMeshes {
  const outerVertices: number[] = [];
  const outerNormals: number[] = [];
  const outerIndices: number[] = [];

  const innerVertices: number[] = [];
  const innerNormals: number[] = [];
  const innerIndices: number[] = [];

  const capVertices: number[] = [];
  const capNormals: number[] = [];
  const capIndices: number[] = [];

  let hasInner = false;

  for (const region of regions) {
    if (region.b - region.a < 1e-12) continue;
    const topFn = functions[region.topFunctionIndex];
    const botFn = functions[region.bottomFunctionIndex];
    const isSingleFn = region.topFunctionIndex === region.bottomFunctionIndex;
    const h = (region.b - region.a) / radialSegments;
    const k = axis.value;

    const outerBaseIdx = outerVertices.length / 3;
    for (let i = 0; i <= radialSegments; i++) {
      const x = region.a + i * h;
      const outerY = tryEvalFn(topFn, x);
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        if (axis.type === 'x') {
          outerVertices.push(x, outerY * cos + k * (1 - cos), outerY * sin);
          outerNormals.push(0, cos, sin);
        } else {
          const r = x - k;
          outerVertices.push(k + r * cos, outerY, r * sin);
          outerNormals.push(cos, 0, sin);
        }
      }
    }

    for (let i = 0; i < radialSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = outerBaseIdx + i * (segments + 1) + j;
        const b = a + segments + 1;
        outerIndices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    if (!isSingleFn) {
      hasInner = true;
      const innerBaseIdx = innerVertices.length / 3;
      for (let i = 0; i <= radialSegments; i++) {
        const x = region.a + i * h;
        const innerY = tryEvalFn(botFn, x);
        for (let j = 0; j <= segments; j++) {
          const theta = (j / segments) * Math.PI * 2;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          if (axis.type === 'x') {
            innerVertices.push(x, innerY * cos + k * (1 - cos), innerY * sin);
            innerNormals.push(0, -cos, -sin);
          } else {
            const r = x - k;
            innerVertices.push(k + r * cos, innerY, r * sin);
            innerNormals.push(-cos, 0, -sin);
          }
        }
      }

      for (let i = 0; i < radialSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = innerBaseIdx + i * (segments + 1) + j;
          const b = a + segments + 1;
          innerIndices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }

    const topY = tryEvalFn(topFn, region.a);
    const botY = isSingleFn ? k : tryEvalFn(botFn, region.a);
    const capBase = capVertices.length / 3;

    if (isSingleFn) {
      if (axis.type === 'x') {
        capVertices.push(region.a, k, 0);
        capNormals.push(-1, 0, 0);
      } else {
        capVertices.push(k, topY, 0);
        capNormals.push(0, 0, -1);
      }
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        if (axis.type === 'x') {
          capVertices.push(region.a, topY * cos + k * (1 - cos), topY * sin);
          capNormals.push(-1, 0, 0);
        } else {
          const r = region.a - k;
          capVertices.push(k + r * cos, topY, r * sin);
          capNormals.push(0, 0, -1);
        }
      }
      for (let j = 0; j < segments; j++) {
        capIndices.push(capBase, capBase + 2 + j, capBase + 1 + j);
      }
    } else {
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        if (axis.type === 'x') {
          capVertices.push(region.a, topY * cos + k * (1 - cos), topY * sin);
          capNormals.push(-1, 0, 0);
          capVertices.push(region.a, botY * cos + k * (1 - cos), botY * sin);
          capNormals.push(-1, 0, 0);
        } else {
          const r = region.a - k;
          capVertices.push(k + r * cos, topY, r * sin);
          capNormals.push(0, 0, -1);
          capVertices.push(k + r * cos, botY, r * sin);
          capNormals.push(0, 0, -1);
        }
      }
      const capStride = 2;
      for (let j = 0; j < segments; j++) {
        const a = capBase + j * capStride;
        const b = capBase + (j + 1) * capStride;
        capIndices.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }

    const topYb = tryEvalFn(topFn, region.b);
    const botYb = isSingleFn ? k : tryEvalFn(botFn, region.b);
    const botCapBase = capVertices.length / 3;

    if (isSingleFn) {
      if (axis.type === 'x') {
        capVertices.push(region.b, k, 0);
        capNormals.push(1, 0, 0);
      } else {
        capVertices.push(k, topYb, 0);
        capNormals.push(0, 0, 1);
      }
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        if (axis.type === 'x') {
          capVertices.push(region.b, topYb * cos + k * (1 - cos), topYb * sin);
          capNormals.push(1, 0, 0);
        } else {
          const r = region.b - k;
          capVertices.push(k + r * cos, topYb, r * sin);
          capNormals.push(0, 0, 1);
        }
      }
      for (let j = 0; j < segments; j++) {
        capIndices.push(botCapBase, botCapBase + 1 + j, botCapBase + 2 + j);
      }
    } else {
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        if (axis.type === 'x') {
          capVertices.push(region.b, topYb * cos + k * (1 - cos), topYb * sin);
          capNormals.push(1, 0, 0);
          capVertices.push(region.b, botYb * cos + k * (1 - cos), botYb * sin);
          capNormals.push(1, 0, 0);
        } else {
          const r = region.b - k;
          capVertices.push(k + r * cos, topYb, r * sin);
          capNormals.push(0, 0, 1);
          capVertices.push(k + r * cos, botYb, r * sin);
          capNormals.push(0, 0, 1);
        }
      }
      const capStride = 2;
      for (let j = 0; j < segments; j++) {
        const a = botCapBase + j * capStride;
        const b = botCapBase + (j + 1) * capStride;
        capIndices.push(a, b + 1, a + 1, a, b, b + 1);
      }
    }
  }

  const outer = new BufferGeometry();
  outer.setAttribute('position', new Float32BufferAttribute(outerVertices, 3));
  outer.setAttribute('normal', new Float32BufferAttribute(outerNormals, 3));
  outer.setIndex(outerIndices);

  const caps = new BufferGeometry();
  caps.setAttribute('position', new Float32BufferAttribute(capVertices, 3));
  caps.setAttribute('normal', new Float32BufferAttribute(capNormals, 3));
  caps.setIndex(capIndices);

  let inner: BufferGeometry | null = null;
  if (hasInner) {
    inner = new BufferGeometry();
    inner.setAttribute('position', new Float32BufferAttribute(innerVertices, 3));
    inner.setAttribute('normal', new Float32BufferAttribute(innerNormals, 3));
    inner.setIndex(innerIndices);
  }

  return { outer, inner, caps };
}
