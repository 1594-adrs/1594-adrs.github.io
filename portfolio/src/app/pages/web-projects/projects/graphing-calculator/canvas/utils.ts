// Canvas 2D context does not support CSS variables; these utilities are for canvas rendering only.

const CLAMP = 1e15;

export function tryEval(fn: (x: number) => number, x: number): number {
  try {
    const y = fn(x);
    if (!isFinite(y)) return NaN;
    if (y > CLAMP) return CLAMP;
    if (y < -CLAMP) return -CLAMP;
    return y;
  } catch {
    return NaN;
  }
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

function safeEval(fn: (x: number) => number, x: number): number | null {
  try {
    const y = fn(x);
    return isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

/**
 * Finds the x-values where `fn(x) === k` on [a, b]. Rejects sign changes
 * caused by a pole jump (e.g. tan(x) swinging from +Infinity to -Infinity
 * through y=k without ever actually crossing it) and additionally detects
 * tangencies — a local minimum of |fn(x) - k| that touches zero without a
 * sign change (e.g. x^2 vs 0 at x=0, or sin(x) vs 1 at x=pi/2) — refining
 * each via golden-section search on |fn(x) - k|.
 */
export function findAxisCrossings(
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  steps = 500,
): number[] {
  const h = (b - a) / steps;
  const EPS = 1e-12;

  const xs: number[] = [];
  const diffs: Array<number | null> = [];
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = safeEval(fn, x);
    xs.push(x);
    diffs.push(y === null ? null : y - k);
  }

  /** Median |diff| of a few samples straddling `i` (excluding it) — a "normal" baseline. */
  function neighborScale(i: number, exclude: number[]): number {
    const vals: number[] = [];
    for (let o = 3; o <= 8; o++) {
      for (const j of [i - o, i + o]) {
        if (j < 0 || j >= diffs.length || exclude.includes(j)) continue;
        const d = diffs[j];
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

  const crossings: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const dCur = diffs[i];
    if (dCur === null) continue;
    if (Math.abs(dCur) < EPS) {
      crossings.push(xs[i]);
      continue;
    }
    if (i === 0) continue;
    const dPrev = diffs[i - 1];
    if (dPrev === null) continue;
    if (dPrev * dCur < 0) {
      if (isPoleJump(i)) continue;
      const t = dPrev / (dPrev - dCur);
      const rootX = xs[i - 1] + t * h;
      const rootY = safeEval(fn, rootX);
      // Guards against a bisection that converges onto the pole itself
      // (where the interpolated x lands near a singularity rather than an
      // actual root, so f no longer -> k there).
      if (rootY === null || Math.abs(rootY - k) > Math.max(1, Math.abs(k)) * 0.05) continue;
      crossings.push(rootX);
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
      const y = safeEval(fn, x);
      return y === null ? Infinity : Math.abs(y - k);
    };
    const xMin = goldenSectionMinimize(objective, lo, hi);
    const yMin = safeEval(fn, xMin);
    if (yMin === null) continue;
    if (Math.abs(yMin - k) > 1e-6) continue;
    crossings.push(xMin);
  }

  crossings.sort((x1, x2) => x1 - x2);
  const deduped: number[] = [];
  for (const x of crossings) {
    if (deduped.length === 0 || Math.abs(x - deduped[deduped.length - 1]) > h * 2) {
      deduped.push(x);
    }
  }
  return deduped;
}
