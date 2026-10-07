/**
 * Small numeric helpers shared by the engine (intersections, critical points) and re-exported
 * by `canvas/utils.ts` for the renderers. Pure math: no DOM, no Angular, no imports from
 * `canvas/` or `models/`.
 */

const CLAMP = 1e15;

/** Evaluates `fn(x)` for drawing: NaN when it throws or is non-finite, clamped to +-1e15. */
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

/** `fn(x)` or null when it throws or is non-finite. */
export function safeEval(fn: (x: number) => number, x: number): number | null {
  try {
    const y = fn(x);
    return isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

/** Minimizes a unimodal function on [lo, hi] via golden-section search. */
export function goldenSectionMinimize(
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

/**
 * Bisects the sign change of `g` between `x0` and `x1` (where `g(x0)` and `g(x1)` have opposite
 * signs) down to floating-point resolution. Returns the endpoint with the smaller |g|, or null
 * when `g` stops being finite inside the bracket. The caller decides whether the result is a
 * genuine root (|g| tiny) or a pole / jump discontinuity (|g| stays large) - that check is
 * scale-relative, unlike the old fixed 0.05 guard that rejected valid roots of steep curves.
 */
export function bisectSignChange(
  g: (x: number) => number,
  x0: number,
  x1: number,
  iterations = 80,
): number | null {
  let lo = x0;
  let hi = x1;
  let gLo = g(lo);
  let gHi = g(hi);
  if (!isFinite(gLo) || !isFinite(gHi) || gLo * gHi > 0) return null;
  for (let i = 0; i < iterations; i++) {
    const mid = lo + (hi - lo) / 2;
    if (mid === lo || mid === hi) break;
    const gm = g(mid);
    if (!isFinite(gm)) return null;
    if (gm === 0) return mid;
    if (gm < 0 === gLo < 0) {
      lo = mid;
      gLo = gm;
    } else {
      hi = mid;
      gHi = gm;
    }
  }
  return Math.abs(gLo) <= Math.abs(gHi) ? lo : hi;
}

/** Relative residual under which a bisected sign change counts as a real root (not a pole). */
export const ROOT_RESIDUAL_REL = 1e-6;

/**
 * Finds the x-values where `fn(x) === k` on [a, b]. Sign changes are bisected to full precision
 * and kept only when the residual is negligible relative to max(1, |k|), which rejects pole jumps
 * (e.g. tan(x) swinging from +Infinity to -Infinity through y=k) without false negatives on wide
 * domains. Also detects tangencies - a local minimum of |fn(x) - k| that touches zero without a
 * sign change (x^2 vs 0 at x=0, sin(x) vs 1 at x=pi/2) - refined by golden-section search.
 * A run of consecutive samples sitting on k (a flat stretch) is reported once, at its start; a
 * function identically equal to k has no discrete crossings and returns [].
 */
export function findAxisCrossings(
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  steps = 500,
): number[] {
  const h = (b - a) / steps;
  const scale = Math.max(1, Math.abs(k));
  const eps = 1e-12 * scale;

  const xs: number[] = [];
  const diffs: Array<number | null> = [];
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = safeEval(fn, x);
    xs.push(x);
    diffs.push(y === null ? null : y - k);
  }

  const valid = diffs.filter((d) => d !== null) as number[];
  if (valid.length > 0 && valid.every((d) => Math.abs(d) < eps)) return [];

  const g = (x: number): number => {
    const y = safeEval(fn, x);
    return y === null ? NaN : y - k;
  };

  const crossings: number[] = [];
  let prevWasZero = false;

  for (let i = 0; i <= steps; i++) {
    const dCur = diffs[i];
    if (dCur === null) {
      prevWasZero = false;
      continue;
    }
    if (Math.abs(dCur) < eps) {
      if (!prevWasZero) crossings.push(xs[i]);
      prevWasZero = true;
      continue;
    }
    prevWasZero = false;
    if (i === 0) continue;
    const dPrev = diffs[i - 1];
    if (dPrev === null) continue;
    if (dPrev * dCur < 0) {
      const rootX = bisectSignChange(g, xs[i - 1], xs[i]);
      if (rootX === null) continue;
      const residual = Math.abs(g(rootX));
      if (!(residual <= ROOT_RESIDUAL_REL * scale)) continue;
      crossings.push(rootX);
    }
  }

  // Tangency: a local minimum of |diff| that touches (but doesn't cross) zero.
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

    const objective = (x: number): number => {
      const y = safeEval(fn, x);
      return y === null ? Infinity : Math.abs(y - k);
    };
    const xMin = goldenSectionMinimize(objective, xs[i - 1], xs[i + 1]);
    const yMin = safeEval(fn, xMin);
    if (yMin === null) continue;
    if (Math.abs(yMin - k) > ROOT_RESIDUAL_REL * scale) continue;
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
