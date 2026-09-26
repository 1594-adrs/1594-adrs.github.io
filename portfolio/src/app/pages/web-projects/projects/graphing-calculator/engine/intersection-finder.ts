export interface IntersectionPoint {
  x: number;
  y: number;
  functionIndices: number[];
}

// A diff jump is treated as passing through a pole (not a genuine crossing)
// when it's either absurdly large outright, or wildly larger than the
// surrounding, otherwise-well-behaved samples.
const POLE_ABS_THRESHOLD = 1e6;
const POLE_NEIGHBOR_RATIO = 30;

/** Minimizes a unimodal function on [lo, hi] via golden-section search. */
function goldenSectionMinimize(
  f: (x: number) => number,
  lo: number,
  hi: number,
  iterations = 60,
): number {
  const gr = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - gr * (b - a);
  let d = a + gr * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iterations; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - gr * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + gr * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
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

      /** Median |diff| of a few samples straddling `i` (excluding it) — a "normal" baseline. */
      function neighborScale(i: number, exclude: number[]): number {
        const vals: number[] = [];
        for (let o = 3; o <= 8; o++) {
          for (const k of [i - o, i + o]) {
            if (k < 0 || k >= diffs.length || exclude.includes(k)) continue;
            const d = diffs[k];
            if (d !== null && isFinite(d)) vals.push(Math.abs(d));
          }
        }
        if (vals.length === 0) return 0;
        vals.sort((x1, x2) => x1 - x2);
        return vals[Math.floor(vals.length / 2)];
      }

      /** Whether the sign change straddling sample `i` is a pole discontinuity, not a real crossing. */
      function isPoleJump(i: number): boolean {
        const dPrev = diffs[i - 1];
        const dCur = diffs[i];
        if (dPrev === null || dCur === null) return true;
        const big = Math.max(Math.abs(dPrev), Math.abs(dCur));
        if (big > POLE_ABS_THRESHOLD) return true;
        const scale = neighborScale(i, [i - 1, i]);
        return scale > 0 && big > scale * POLE_NEIGHBOR_RATIO;
      }

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
          if (isFinite(bi) && isFinite(bj) && Math.abs(bi - bj) < 1e-6) {
            found.push({ x: hi, y: bi });
          }
        }
        prevBothValid = bothValid;
      }

      // Exact zeros and sign changes, skipping pole jumps (e.g. tan(x) vs 1:
      // the huge +Infinity -> -Infinity jump at x=pi/2 is not a crossing).
      for (let i = 0; i <= steps; i++) {
        const dCur = diffs[i];
        if (dCur === null) continue;
        if (Math.abs(dCur) < EPS) {
          found.push({ x: xs[i], y: yI[i]! });
          continue;
        }
        if (i === 0) continue;
        const dPrev = diffs[i - 1];
        if (dPrev === null) continue;
        if (dPrev * dCur < 0) {
          if (isPoleJump(i)) continue;
          const t = dPrev / (dPrev - dCur);
          const rootX = xs[i - 1] + t * h;
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
          // Guards against a bisection that converges onto the pole itself
          // (where the interpolated x lands near a singularity rather than
          // an actual root, so f no longer -> the same value on both sides).
          if (!isFinite(rvi) || !isFinite(rvj) || Math.abs(rvi - rvj) > 0.05) continue;
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
        if (Math.abs(vi - vj) > 1e-6) continue;
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
