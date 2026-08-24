export interface IntersectionPoint {
  x: number;
  y: number;
  functionIndices: number[];
}

export function findIntersections(
  functions: Array<(x: number) => number>,
  a: number,
  b: number,
  steps = 200,
): IntersectionPoint[] {
  const h = (b - a) / steps;
  const intersections: IntersectionPoint[] = [];
  const EPS = 1e-12;

  for (let i = 0; i < functions.length; i++) {
    for (let j = i + 1; j < functions.length; j++) {
      let prevDiff = NaN;
      for (let k = 0; k <= steps; k++) {
        const x = a + k * h;
        let yI: number, yJ: number;
        try {
          yI = functions[i](x);
        } catch {
          prevDiff = NaN;
          continue;
        }
        try {
          yJ = functions[j](x);
        } catch {
          prevDiff = NaN;
          continue;
        }
        if (!isFinite(yI) || !isFinite(yJ)) {
          prevDiff = NaN;
          continue;
        }

        const diff = yI - yJ;

        if (Math.abs(diff) < EPS) {
          const existing = intersections.find((p) => Math.abs(p.x - x) < h * 2);
          if (existing) {
            if (!existing.functionIndices.includes(i)) existing.functionIndices.push(i);
            if (!existing.functionIndices.includes(j)) existing.functionIndices.push(j);
          } else {
            intersections.push({ x, y: yI, functionIndices: [i, j] });
          }
          prevDiff = diff;
          continue;
        }

        if (isFinite(prevDiff) && Math.abs(prevDiff) >= EPS && prevDiff * diff < 0) {
          const t = prevDiff / (prevDiff - diff);
          const rootX = a + (k - 1) * h + t * h;
          let rootY: number;
          try {
            rootY = functions[i](rootX);
          } catch {
            rootY = functions[j](rootX);
          }
          const existing = intersections.find((p) => Math.abs(p.x - rootX) < h * 2);
          if (existing) {
            if (!existing.functionIndices.includes(i)) existing.functionIndices.push(i);
            if (!existing.functionIndices.includes(j)) existing.functionIndices.push(j);
          } else {
            intersections.push({ x: rootX, y: rootY, functionIndices: [i, j] });
          }
        }
        prevDiff = diff;
      }
    }
  }

  intersections.sort((a, b) => a.x - b.x);
  return intersections;
}
