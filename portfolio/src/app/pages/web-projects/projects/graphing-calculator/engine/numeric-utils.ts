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
 * Finds the x-values where `fn(x) === k` on [a, b] from `steps` uniform samples.
 * - Sign changes are bisected to full precision and kept only when the residual is negligible
 *   relative to max(1, |k|), which rejects pole jumps (tan(x) swinging through y=k).
 * - A run of samples within 1e-12 of k is one zero: bisected between its neighbours when they
 *   have opposite signs (an odd high-multiplicity zero like (x-1)^9), else refined as a touch.
 *   A run with two or more samples exactly on k is a flat stretch, reported once at its start; a
 *   function identically equal to k returns [].
 * - Touches - a local minimum of |fn - k| without a sign change - are refined by golden-section
 *   search on the signed difference: a minimum near 0 is a tangency (x^2 at 0), one through 0 is
 *   two zeros closer than the sample spacing ((x-1)(x-1.001)), each bisected.
 * - Where the domain ends (a sample is undefined) and |fn - k| decreases toward it, the boundary
 *   is bisected and counts as a zero when fn reaches k there (sqrt(8x-1) at 1/8).
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
  const tol = ROOT_RESIDUAL_REL * scale;
  const g = (x: number): number => {
    const y = safeEval(fn, x);
    return y === null ? NaN : y - k;
  };

  const xs: number[] = [];
  const d: number[] = []; // NaN where fn is undefined
  for (let i = 0; i <= steps; i++) {
    xs.push(a + i * h);
    d.push(g(xs[i]));
  }

  const valid = d.filter(Number.isFinite);
  if (valid.length > 0 && valid.every((v) => Math.abs(v) < eps)) return [];

  const ok = Number.isFinite;
  const near = (i: number): boolean => Math.abs(d[i]) < eps; // false for NaN
  const roots: number[] = [];

  const addBisected = (x0: number, x1: number): void => {
    const r = bisectSignChange(g, x0, x1);
    if (r !== null && Math.abs(g(r)) <= tol) roots.push(r);
  };

  // Minimum of s*g on [lo, hi] (|g| when s = 0). Through zero: two roots, bisected on each side;
  // returns null. Otherwise the minimum point when it touches zero, else null.
  const touch = (lo: number, hi: number, s: number): number | null => {
    const obj = (t: number): number => {
      const v = g(t);
      return Number.isNaN(v) ? Infinity : s ? s * v : Math.abs(v);
    };
    const xm = goldenSectionMinimize(obj, lo, hi);
    const dm = g(xm);
    if (!ok(dm)) return null;
    if (s * dm <= -eps) {
      addBisected(lo, xm);
      addBisected(xm, hi);
      return null;
    }
    return Math.abs(dm) <= tol ? xm : null;
  };

  const cluster = (i: number, j: number): void => {
    const dl = i > 0 ? d[i - 1] : NaN;
    const dr = j < steps ? d[j + 1] : NaN;
    if (dl * dr < 0) return addBisected(xs[i - 1], xs[j + 1]);
    const zero = d.slice(i, j + 1).indexOf(0);
    const twoSided = ok(dl) && ok(dr);
    if (zero >= 0 && !twoSided) {
      roots.push(xs[i + zero]);
      return;
    }
    const xm = touch(xs[ok(dl) ? i - 1 : i], xs[ok(dr) ? j + 1 : j], twoSided ? Math.sign(dl) : 0);
    if (xm !== null) roots.push(zero >= 0 ? xs[i + zero] : xm);
  };

  // Last valid point before the domain ends between `inside` (defined) and `outside`.
  const domainEdge = (inside: number, outside: number): void => {
    for (let it = 0; it < 80; it++) {
      const mid = inside + (outside - inside) / 2;
      if (mid === inside || mid === outside) break;
      if (ok(g(mid))) inside = mid;
      else outside = mid;
    }
    if (Math.abs(g(inside)) <= tol) roots.push(inside);
  };
  const shrinksToward = (i: number, inward: number): boolean =>
    !ok(d[inward]) || Math.abs(d[i]) < Math.abs(d[inward]);

  for (let i = 0; i <= steps; i++) {
    if (!ok(d[i])) continue;
    if (near(i)) {
      let j = i;
      while (j < steps && near(j + 1)) j++;
      cluster(i, j);
      i = j;
      continue;
    }
    const strict = (q: number): boolean => q >= 0 && q <= steps && ok(d[q]) && !near(q);
    if (strict(i + 1) && d[i] * d[i + 1] < 0) addBisected(xs[i], xs[i + 1]);
    if (i > 0 && !ok(d[i - 1]) && shrinksToward(i, i + 1)) domainEdge(xs[i], xs[i - 1]);
    if (i < steps && !ok(d[i + 1]) && shrinksToward(i, i - 1)) domainEdge(xs[i], xs[i + 1]);
    if (!strict(i - 1) || !strict(i + 1)) continue;
    if (d[i - 1] * d[i] < 0 || d[i] * d[i + 1] < 0) continue;
    const aPrev = Math.abs(d[i - 1]);
    const aCur = Math.abs(d[i]);
    const aNext = Math.abs(d[i + 1]);
    if (!(aCur < aPrev && aCur <= aNext)) continue;
    if (!(aCur < aPrev * 0.9 || aCur < aNext * 0.9)) continue;
    const xm = touch(xs[i - 1], xs[i + 1], Math.sign(d[i]));
    if (xm !== null) roots.push(xm);
  }

  // The passes above cover disjoint brackets; this only drops exact float duplicates.
  roots.sort((x1, x2) => x1 - x2);
  return roots.filter((x, i) => i === 0 || x - roots[i - 1] > 1e-12 * Math.max(1, Math.abs(x)));
}
