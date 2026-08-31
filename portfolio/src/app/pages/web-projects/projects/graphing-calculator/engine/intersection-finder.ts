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
      let prevBothValid = false;
      for (let k = 0; k <= steps; k++) {
        const x = a + k * h;
        let yI: number, yJ: number;
        try {
          yI = functions[i](x);
        } catch {
          prevDiff = NaN;
          prevBothValid = false;
          continue;
        }
        try {
          yJ = functions[j](x);
        } catch {
          prevDiff = NaN;
          prevBothValid = false;
          continue;
        }
        if (!isFinite(yI) || !isFinite(yJ)) {
          prevDiff = NaN;
          prevBothValid = false;
          continue;
        }

        const bothValid = isFinite(yI) && isFinite(yJ);

        if (!prevBothValid && bothValid) {
          let lo = x - h;
          let hi = x;
          for (let iter = 0; iter < 50; iter++) {
            const mid = (lo + hi) / 2;
            let midI: number, midJ: number;
            try {
              midI = functions[i](mid);
            } catch {
              midI = NaN;
            }
            try {
              midJ = functions[j](mid);
            } catch {
              midJ = NaN;
            }
            if (isFinite(midI) && isFinite(midJ)) {
              hi = mid;
            } else {
              lo = mid;
            }
          }
          let bYI: number, bYJ: number;
          try {
            bYI = functions[i](hi);
          } catch {
            bYI = NaN;
          }
          try {
            bYJ = functions[j](hi);
          } catch {
            bYJ = NaN;
          }
          if (isFinite(bYI) && isFinite(bYJ) && Math.abs(bYI - bYJ) < 1e-6) {
            const existing = intersections.find((p) => Math.abs(p.x - hi) < h * 2);
            if (!existing) {
              intersections.push({ x: hi, y: bYI, functionIndices: [i, j] });
            }
          }
        }
        prevBothValid = bothValid;

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
