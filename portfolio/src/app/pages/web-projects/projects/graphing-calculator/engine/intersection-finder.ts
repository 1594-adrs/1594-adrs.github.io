import { bisectSignChange, goldenSectionMinimize, ROOT_RESIDUAL_REL } from './numeric-utils';

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

  for (let fi = 0; fi < functions.length; fi++) {
    for (let fj = fi + 1; fj < functions.length; fj++) {
      const fnI = functions[fi];
      const fnJ = functions[fj];

      const xs: number[] = [];
      const yI: Array<number | null> = [];
      const yJ: Array<number | null> = [];
      const diffs: Array<number | null> = [];

      for (let i = 0; i <= steps; i++) {
        const x = a + i * h;
        let vi: number, vj: number;
        try {
          vi = fnI(x);
        } catch {
          vi = NaN;
        }
        try {
          vj = fnJ(x);
        } catch {
          vj = NaN;
        }
        const validI = isFinite(vi);
        const validJ = isFinite(vj);
        xs.push(x);
        yI.push(validI ? vi : null);
        yJ.push(validJ ? vj : null);
        diffs.push(validI && validJ ? vi - vj : null);
      }

      // Coincident curves (diff ~ 0 on every sample where both are defined) have no discrete
      // intersections - skip them instead of reporting one point per sample.
      let validCount = 0;
      let zeroCount = 0;
      for (let i = 0; i <= steps; i++) {
        const d = diffs[i];
        if (d === null) continue;
        validCount++;
        if (Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(yI[i] ?? 0))) zeroCount++;
      }
      if (validCount > 0 && zeroCount === validCount) continue;

      const found: Array<{ x: number; y: number }> = [];

      // Domain-boundary crossing: fi/fj both become defined at the same x
      // (e.g. x^2 vs sqrt(x) meeting exactly at x=0) without a sign change to
      // detect, since one or both sides are undefined right up to that point.
      let prevBothValid = yI[0] !== null && yJ[0] !== null;
      for (let i = 1; i <= steps; i++) {
        const bothValid = yI[i] !== null && yJ[i] !== null;
        if (!prevBothValid && bothValid) {
          let lo = xs[i] - h;
          let hi = xs[i];
          for (let iter = 0; iter < 50; iter++) {
            const mid = (lo + hi) / 2;
            let mi: number, mj: number;
            try {
              mi = fnI(mid);
            } catch {
              mi = NaN;
            }
            try {
              mj = fnJ(mid);
            } catch {
              mj = NaN;
            }
            if (isFinite(mi) && isFinite(mj)) {
              hi = mid;
            } else {
              lo = mid;
            }
          }
          let bi: number, bj: number;
          try {
            bi = fnI(hi);
          } catch {
            bi = NaN;
          }
          try {
            bj = fnJ(hi);
          } catch {
            bj = NaN;
          }
          if (
            isFinite(bi) &&
            isFinite(bj) &&
            Math.abs(bi - bj) <= ROOT_RESIDUAL_REL * Math.max(1, Math.abs(bi))
          ) {
            found.push({ x: hi, y: bi });
          }
        }
        prevBothValid = bothValid;
      }

      // Exact zeros and sign changes. Each sign change is bisected on diff = fnI - fnJ and kept
      // only when the residual there is negligible relative to the curves' magnitude: a pole jump
      // (tan(x) vs 1 at x=pi/2) or a step discontinuity never converges to a small residual, while
      // a genuine crossing of a steep or distant curve (x^2 vs 2 on [-100, 100], exp(x) vs 1000)
      // always does. A run of consecutive zero samples (flat overlap) is reported once.
      const diffAt = (x: number): number => {
        let vi: number, vj: number;
        try {
          vi = fnI(x);
        } catch {
          vi = NaN;
        }
        try {
          vj = fnJ(x);
        } catch {
          vj = NaN;
        }
        return vi - vj;
      };
      let prevWasZero = false;
      for (let i = 0; i <= steps; i++) {
        const dCur = diffs[i];
        if (dCur === null) {
          prevWasZero = false;
          continue;
        }
        if (Math.abs(dCur) < EPS) {
          if (!prevWasZero) found.push({ x: xs[i], y: yI[i]! });
          prevWasZero = true;
          continue;
        }
        prevWasZero = false;
        if (i === 0) continue;
        const dPrev = diffs[i - 1];
        if (dPrev === null) continue;
        if (dPrev * dCur < 0) {
          const rootX = bisectSignChange(diffAt, xs[i - 1], xs[i]);
          if (rootX === null) continue;
          let rvi: number, rvj: number;
          try {
            rvi = fnI(rootX);
          } catch {
            rvi = NaN;
          }
          try {
            rvj = fnJ(rootX);
          } catch {
            rvj = NaN;
          }
          if (!isFinite(rvi) || !isFinite(rvj)) continue;
          const tolerance = ROOT_RESIDUAL_REL * Math.max(1, Math.abs(rvi), Math.abs(rvj));
          if (Math.abs(rvi - rvj) > tolerance) continue;
          found.push({ x: rootX, y: rvi });
        }
      }

      // Tangency: a local minimum of |diff| that touches (but doesn't cross)
      // zero, e.g. x^2 vs 0 at x=0, or sin(x) vs 1 at x=pi/2.
      for (let i = 1; i < steps; i++) {
        const dPrev = diffs[i - 1];
        const dCur = diffs[i];
        const dNext = diffs[i + 1];
        if (dPrev === null || dCur === null || dNext === null) continue;
        if (dPrev * dCur < 0 || dCur * dNext < 0) continue;

        const aPrev = Math.abs(dPrev);
        const aCur = Math.abs(dCur);
        const aNext = Math.abs(dNext);
        if (!(aCur < aPrev && aCur <= aNext)) continue;
        if (aCur === 0) continue;
        if (!(aCur < aPrev * 0.9 || aCur < aNext * 0.9)) continue;

        const lo = xs[i - 1];
        const hi = xs[i + 1];
        const objective = (x: number): number => {
          let vi: number, vj: number;
          try {
            vi = fnI(x);
          } catch {
            vi = NaN;
          }
          try {
            vj = fnJ(x);
          } catch {
            vj = NaN;
          }
          if (!isFinite(vi) || !isFinite(vj)) return Infinity;
          return Math.abs(vi - vj);
        };
        const xMin = goldenSectionMinimize(objective, lo, hi);
        let vi: number, vj: number;
        try {
          vi = fnI(xMin);
        } catch {
          vi = NaN;
        }
        try {
          vj = fnJ(xMin);
        } catch {
          vj = NaN;
        }
        if (!isFinite(vi) || !isFinite(vj)) continue;
        if (Math.abs(vi - vj) > ROOT_RESIDUAL_REL * Math.max(1, Math.abs(vi))) continue;
        found.push({ x: xMin, y: vi });
      }

      found.sort((p, q) => p.x - q.x);
      for (const p of found) {
        const existing = intersections.find((q) => Math.abs(q.x - p.x) < h * 2);
        if (existing) {
          if (!existing.functionIndices.includes(fi)) existing.functionIndices.push(fi);
          if (!existing.functionIndices.includes(fj)) existing.functionIndices.push(fj);
        } else {
          intersections.push({ x: p.x, y: p.y, functionIndices: [fi, fj] });
        }
      }
    }
  }

  intersections.sort((p, q) => p.x - q.x);
  return intersections;
}
