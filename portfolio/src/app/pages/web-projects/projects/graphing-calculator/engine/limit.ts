/**
 * Numeric limit of a real function. Pure math: no DOM/Angular.
 *
 * Each side becomes a sequence g_k = f(x0 ± t_k) with t_k = t0·2^-k (x_k = ±1.3·2^k at ±∞),
 * classified in this order:
 *  1. finite: Aitken Δ² on 5-sample windows, coarse → fine (exact for g = L + c·t^p, any p > 0);
 *     the scan stops at the first smooth run, before the rounding noise of 0/0 forms at tiny t.
 *  2. infinite: one sign and |g| growing with non-shrinking steps, to the last sample or for a
 *     long run that only cancellation noise ends.
 *  3. logarithmic: g polynomial in s = 1/ln(1/t) (ln(2x)/ln(x), x^(1/ln x)…), Neville to s = 0.
 *  4. squeeze: the spread of the samples collapses by orders of magnitude (x·sin(1/x) → 0).
 *  5. dne: steps keep changing sign while the spread stays comparable to |g| (sin(1/x)).
 * Anything else is 'unknown': never a confident guess.
 */

export interface LimitResult {
  /** ±Infinity for 'infinite'; NaN for 'dne' and 'unknown'. */
  value: number;
  status: 'finite' | 'infinite' | 'dne' | 'unknown';
}

/** Samples per side: a call evaluates f at most 2·LIMIT_SAMPLES_PER_SIDE times. */
export const LIMIT_SAMPLES_PER_SIDE = 50;
/** First offset (× max(1, |x0|)); not dyadic, so sin(π/x)-type functions don't alias on 2^-k. */
const T0 = 0.13;
const X_INF0 = 1.3;
/** Relative error of a window fit accepted at once (coarse → fine). */
const STRICT = 1e-9;
/** Relative error of the best fit in the first smooth run of windows, accepted when it ends. */
const LOOSE = 1e-6;
/** A finite estimate below this × the magnitude of the samples it came from is 0. */
const ZERO_SNAP = 1e-6;
/** Fewer defined samples than this on a side → the function is not defined there. */
const MIN_RUN = 8;
/** Steps of a converging window shrink at least this fast (t^p with p ≳ 0.07). */
const MAX_RATIO = 0.95;

const UNKNOWN: LimitResult = { value: NaN, status: 'unknown' };
const DNE: LimitResult = { value: NaN, status: 'dne' };

type SideResult = LimitResult | 'undefined';

export function computeLimit(f: (x: number) => number, x0: number, side?: '-' | '+'): LimitResult {
  if (Number.isNaN(x0)) return UNKNOWN;
  if (!Number.isFinite(x0)) return publish(limitSide(f, x0, x0 > 0 ? 1 : -1));
  const right = side === '-' ? null : limitSide(f, x0, 1);
  const left = side === '+' ? null : limitSide(f, x0, -1);
  if (!left || !right) return publish((left ?? right)!);
  return combine(left, right);
}

/** One-sided limit on an undefined side: there are no points to approach from. */
function publish(r: SideResult): LimitResult {
  return r === 'undefined' ? DNE : r;
}

function combine(l: SideResult, r: SideResult): LimitResult {
  // shortcut: a two-sided limit where f is defined on one side only is the one-sided limit
  // (domain-endpoint convention the dataset uses); make it 'dne' if a strict mode is needed.
  if (l === 'undefined' || r === 'undefined') return publish(l === 'undefined' ? r : l);
  if (l.status === 'dne' || r.status === 'dne') return DNE;
  if (l.status === 'unknown' || r.status === 'unknown') return UNKNOWN;
  if (l.status !== r.status) return DNE; // finite on one side, infinite on the other
  if (l.status === 'infinite') return l.value === r.value ? l : DNE;
  const gap = Math.abs(l.value - r.value);
  const scale = Math.max(Math.abs(l.value), Math.abs(r.value));
  // Each side is good to ~LOOSE; a smaller jump is not resolvable.
  if (gap <= 10 * LOOSE * scale) return { value: (l.value + r.value) / 2, status: 'finite' };
  return gap > 1e-3 * scale ? DNE : UNKNOWN;
}

/** Samples g and their log-scale coordinate s = 1/ln(1/t) (1/ln|x| at ±∞; NaN when t ≥ 1). */
interface Samples {
  g: number[];
  s: number[];
}

function limitSide(f: (x: number) => number, x0: number, dir: 1 | -1): SideResult {
  const out: Samples = { g: [], s: [] };
  const finite = Number.isFinite(x0);
  let t = finite ? T0 * Math.max(1, Math.abs(x0)) : X_INF0;
  for (let k = 0; k < LIMIT_SAMPLES_PER_SIDE; k++) {
    const x = finite ? x0 + dir * t : dir * t;
    // Rounding of x0 ± t now dominates the offset: deeper samples are not closer to x0.
    if (finite && Math.abs(x - x0 - dir * t) > 1e-4 * t) break;
    try {
      out.g.push(f(x));
    } catch {
      return UNKNOWN; // e.g. unknown identifier: nothing to conclude
    }
    const lnInv = finite ? -Math.log(t) : Math.log(t);
    out.s.push(lnInv > 0 ? 1 / lnInv : NaN);
    t = finite ? t / 2 : t * 2;
  }
  return classify(longestDefinedRun(out));
}

function longestDefinedRun({ g, s }: Samples): Samples {
  let best: Samples = { g: [], s: [] };
  let start = 0;
  for (let i = 0; i <= g.length; i++) {
    if (i < g.length && !Number.isNaN(g[i])) continue;
    if (i - start > best.g.length) best = { g: g.slice(start, i), s: s.slice(start, i) };
    start = i + 1;
  }
  return best;
}

function classify({ g: v, s }: Samples): SideResult {
  if (v.length < MIN_RUN) return 'undefined';
  const fin = finiteLimit(v);
  if (typeof fin === 'number') {
    // (1 − cos x)/x⁴ blows up until 1 − cos x rounds to 0: a constant tail after a blow-up is noise.
    let c = v.length - 1;
    while (c > 0 && v[c - 1] === v[v.length - 1]) c--;
    const blowUp = v.length - c >= 5 ? divergence(v.slice(0, c)) : 0;
    return blowUp ? { value: blowUp, status: 'infinite' } : { value: fin, status: 'finite' };
  }
  const log = logLimit(v, s);
  if (log !== null) return { value: log, status: 'finite' };
  // Nearly converged, then lost to rounding: a growing or erratic tail is noise, not the limit.
  const noisy = fin === 'near';
  const inf = noisy ? 0 : divergence(v);
  if (inf) return { value: inf, status: 'infinite' };
  const sq = squeeze(v);
  if (sq !== null) return Number.isNaN(sq) ? UNKNOWN : { value: sq, status: 'finite' };
  const half = v.length >> 1;
  return !noisy && oscillates(v.slice(0, half)) && oscillates(v.slice(half)) ? DNE : UNKNOWN;
}

interface Fit {
  value: number;
  /** Relative error estimate. */
  err: number;
  /** Absolute error estimate. */
  abs: number;
}

/** Samples per window: two levels of Aitken Δ² leave three estimates to compare. */
const WINDOW = 7;

/**
 * Scans windows coarse → fine. A window fitting to STRICT is returned at once; otherwise the best
 * fit of the first run of smooth windows, if within LOOSE. Stopping there keeps the answer clear
 * of the rounding noise (often a constant 0) that 0/0 forms reach at tiny t. Zero is judged
 * against the largest sample of the run (a deep window only sees tiny values): a smooth run that
 * decayed by ZERO_SNAP is going to 0 even if the window's relative fit is poor (x^(-1/2)/ln x).
 * 'near' = some window fitted to 1e-4 but none was accepted.
 */
function finiteLimit(v: number[]): number | 'near' | null {
  let best: Fit | null = null;
  let runMag = 0;
  let near = false;
  const snap = (L: number) => (Math.abs(L) <= ZERO_SNAP * runMag ? 0 : L);
  // Windows end at sample k + 4: 5 samples at the coarse start (heavy 0/0 forms are noisy soon).
  for (let k = 0; k + 5 <= v.length; k++) {
    const w = v.slice(Math.max(0, k + 5 - WINDOW), k + 5);
    const fit = fitWindow(w);
    if (fit) {
      runMag = Math.max(runMag, ...w.map(Math.abs));
      if (fit.err <= STRICT || Math.abs(fit.value) + fit.abs <= ZERO_SNAP * runMag) {
        return snap(fit.value);
      }
      if (!best || fit.err < best.err) best = fit;
      near ||= fit.err <= 1e-4;
      continue;
    }
    if (best && best.err <= LOOSE) return snap(best.value);
    best = null;
    runMag = 0;
  }
  if (best && best.err <= LOOSE) return snap(best.value);
  return near ? 'near' : null;
}

/**
 * Aitken Δ² fit of a window whose steps shrink geometrically (g = L + c·t^p + …); null when they
 * don't. Level 1 (last 5 samples): error = the smaller of the spread of its three estimates and
 * the last correction (the geometric tail, tiny for super-geometric decay such as (3/4)^x).
 * Level 2 (Aitken of the Aitken estimates, 7 samples) removes the next term (t^2p, slow t^(2/15)).
 */
function fitWindow(w: number[]): Fit | null {
  if (!w.every(Number.isFinite)) return null;
  const mag = Math.max(...w.map(Math.abs));
  const n = w.length;
  const tail = w.slice(n - 5);
  if (Math.max(...tail) - Math.min(...tail) <= 1e-12 * mag)
    return { value: w[n - 1], err: 0, abs: 0 };
  const d = w.slice(1).map((x, i) => x - w[i]);
  // On a growing sequence Aitken returns the "anti-limit"; on noise, garbage.
  const shrinks = (j: number) => d[j + 1] / d[j] > 0 && d[j + 1] / d[j] < MAX_RATIO;
  if (![n - 4, n - 3, n - 2].every((j) => shrinks(j - 1))) return null;
  const a1 = aitken(w);
  const L = a1[a1.length - 1];
  const scale = Math.max(Math.abs(L), mag);
  const spread = (s: number[]) => Math.max(...s) - Math.min(...s);
  const abs = Math.min(spread(a1.slice(-3)), Math.abs(L - w[n - 1]));
  const fit = { value: L, err: abs / scale, abs };
  if (n < WINDOW || !d.slice(0, -1).every((_, j) => shrinks(j))) return fit;
  const a2 = aitken(a1);
  const err2 = spread(a2) / scale; // NaN (0/0 on exact steps) never wins
  return err2 < fit.err ? { value: a2[a2.length - 1], err: err2, abs: err2 * scale } : fit;
}

function aitken(a: number[]): number[] {
  return a.slice(2).map((x, i) => {
    const d0 = a[i + 1] - a[i];
    const d1 = x - a[i + 1];
    return x - (d1 * d1) / (d1 - d0);
  });
}

/**
 * ±Infinity for a run of one sign whose |g| grows with non-shrinking steps (power or log growth)
 * that reaches the last sample, or that is long (2·MIN_RUN) and ends in cancellation noise;
 * else 0. Short runs are pre-asymptotic (x³ − 1000x² is negative and growing up to x ≈ 667).
 */
function divergence(v: number[]): number {
  const n = v.length;
  const step = (i: number) => Math.abs(v[i + 1] - v[i]); // NaN for Infinity − Infinity
  const grows = (i: number) => {
    const s = Math.sign(v[i]);
    if (!s || Math.sign(v[i + 1]) !== s || !(Math.abs(v[i + 1]) >= Math.abs(v[i]))) return false;
    // Steps must not shrink: a slowly converging sequence also grows in |g|.
    return i === 0 || !(step(i) < 0.9 * step(i - 1));
  };
  for (let j = 0; j < n - 1;) {
    let m = j;
    while (m < n - 1 && grows(m)) m++;
    const len = m - j + 1;
    const ok =
      (m === n - 1 ? len >= MIN_RUN : len >= 2 * MIN_RUN) &&
      Math.abs(v[m]) >= 4 * Math.abs(v[j]) &&
      !(step(m - 1) < 0.5 * step(j)); // log growth keeps its step; convergence does not
    if (ok) return Math.sign(v[m]) * Infinity;
    j = m + 1;
  }
  return 0;
}

/**
 * Limit of a sequence that converges like 1/ln(1/t) (Aitken stalls there): Neville extrapolation
 * to s = 0 of the last samples, accepted when degrees 3, 4 and 5 agree; else null.
 */
function logLimit(v: number[], s: number[]): number | null {
  const n = v.length;
  if (n < MIN_RUN) return null;
  const vs = v.slice(n - 6);
  const ss = s.slice(n - 6);
  if (!vs.every(Number.isFinite) || !ss.every(Number.isFinite)) return null;
  const est = [3, 4, 5].map((deg) => neville(ss.slice(5 - deg), vs.slice(5 - deg)));
  const L = est[2];
  const mag = Math.max(...v.map(Math.abs));
  if (Math.max(...est) - Math.min(...est) > LOOSE * Math.max(Math.abs(L), mag)) return null;
  return Math.abs(L) <= ZERO_SNAP * mag ? 0 : L;
}

/** Value at 0 of the polynomial through (s[i], g[i]). */
function neville(s: number[], g: number[]): number {
  const p = g.slice();
  for (let m = 1; m < p.length; m++) {
    for (let i = 0; i + m < p.length; i++) {
      p[i] = (s[i + m] * p[i] - s[i] * p[i + 1]) / (s[i + m] - s[i]);
    }
  }
  return p[0];
}

/**
 * Limit when the spread of the last samples is tiny next to the early spread (bounded
 * oscillation squeezed to a value); NaN when squeezed but not precise enough; null otherwise.
 */
function squeeze(v: number[]): number | null {
  if (v.length < 2 * MIN_RUN || !v.every(Number.isFinite)) return null;
  const spread = (s: number[]) => Math.max(...s) - Math.min(...s);
  const tail = v.slice(-MIN_RUN);
  const rTail = spread(tail);
  const mag = Math.max(...v.map(Math.abs));
  if (!(rTail <= 1e-6 * mag && rTail <= 1e-3 * spread(v.slice(0, v.length >> 1)))) return null;
  const center = (Math.max(...tail) + Math.min(...tail)) / 2;
  if (Math.abs(center) <= rTail) return 0;
  return rTail <= 1e-6 * Math.abs(center) ? center : NaN;
}

/** Steps change sign often and the spread is comparable to the values. */
function oscillates(s: number[]): boolean {
  if (s.length < MIN_RUN || !s.every(Number.isFinite)) return false;
  let flips = 0;
  for (let i = 2; i < s.length; i++) {
    if ((s[i] - s[i - 1]) * (s[i - 1] - s[i - 2]) < 0) flips++;
  }
  const mag = Math.max(...s.map(Math.abs));
  return flips >= (s.length - 2) / 4 && Math.max(...s) - Math.min(...s) >= 0.05 * mag;
}
