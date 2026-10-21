/**
 * Sequences aₙ and series Σ aₙ over the integers n ≥ nStart. Pure math: no DOM/Angular.
 *
 * Both reuse computeLimit's staged classification (Aitken, log-scale Neville, divergence,
 * squeeze, oscillation) by feeding it integer samples:
 *  - sequenceLimit: lim aₙ = lim over even offsets (right of x0 = 0) and odd offsets (left), so
 *    the two-sided combine also demands that both parities agree ((-1)ⁿ is 'dne'). Offsets grow
 *    ×2 per sample up to ~4e15; when the terms stop being finite (10ⁿ/n! overflows near n = 170)
 *    or the sequence is a recurrence (O(n) per new term), the samples are packed into the defined
 *    range instead, and a verdict of ±∞ or 0 is kept only if the growth rate of |aₙ| will not
 *    turn (see trendCheck: 1000ⁿ/n! grows until it overflows, but its rate is falling: 'unknown').
 *  - seriesSum: terms that do not go to 0 decide divergence first, then the limit comparison
 *    with Σ1/n and Σ1/(n·ln n). Terms not shown to reach 0 give 'unknown'. Otherwise partial
 *    sums are taken up to MAX_TERMS; a geometric tail (|aₙ₊₁/aₙ| ≤ GEO_RATIO, negligible
 *    remainder) ends the sum at once, so power series cost little and a later NaN (Inf/Inf terms)
 *    cannot spoil them. Slow series go to computeLimit on S(N₀·2ᵏ): the tail c·N^-p is geometric
 *    in k (Σ1/n², Σ(-1)ⁿ/n with an even count). A sum whose rounding error ε·Σ|aₙ| is not small
 *    (Σ(-40)ⁿ/n! cancels terms of 1e16 down to 4e-18) is 'unknown', not a wrong 'finite'.
 */
import { computeLimit, LIMIT_SAMPLES_PER_SIDE, MIN_RUN, type LimitResult } from './limit';

export type Term = (n: number) => number;

/** First sample offset ≈ 1/(2·t0) of limit.ts (t0 = 0.13), so its 1/ln(1/t) is ≈ 1/ln n. */
const M0 = 3.85;
/** Packed offsets still grow by this factor per sample (distinct integers, geometric in k). */
const R_MIN = 1.25;
/** Probes up to nStart + 2^PROBE_BITS; 2·M0·2^49 stays below 2^53, so n is exact. */
const PROBE_BITS = 52;
/** Recurrences cost O(n) per new term (memoized, interpreted): sample them only up to here. */
const RECURRENCE_CAP = 2 ** 16;
/** Most terms a series sum evaluates (slow series only; geometric tails stop much earlier). */
const MAX_TERMS = 2 ** 14;
/** Partial sums are checkpointed at N = N0·2^k terms. */
const N0 = 8;
/** A tail whose term ratios stay below this is summed as geometric. */
const GEO_RATIO = 0.95;
/** A geometric remainder below this × |S| is negligible (a few ulps). */
const TAIL_EPS = 1e-15;
/** The sign of a series whose terms oscillate without a limit is read from this many terms. */
const SIGN_TERMS = 1000;
/** A finite sum needs its rounding error, about ε·Σ|aₙ|, below this × max(1, |S|) (cancellation). */
const CANCEL_REL = 1e-8;
/** n·ln|aₙ₊ₕ/aₙ|/h within this of constant is polynomial growth/decay (no turn ahead). */
const POLY_SLACK = 0.2;
/** …and only when the range is this × the degree n·u: x²⁰⁰ and x²⁰⁰/2ˣ look alike on n ≤ 34. */
const POLY_RANGE = 100;
/** A sampled ±∞ is re-checked at real n up to here (ln n/n^0.01 grows until n ≈ 1e43). */
const FAR_N = 1e300;
const FAR_SAMPLES = 8;
/** Consecutive terms per block when telling oscillation from a slowly shrinking envelope. */
const OSC_BLOCK = 256;

const UNKNOWN: LimitResult = { value: NaN, status: 'unknown' };
const DNE: LimitResult = { value: NaN, status: 'dne' };
const infinite = (sign: number): LimitResult => ({ value: sign * Infinity, status: 'infinite' });

/**
 * lim aₙ as n → ∞: 'finite', 'infinite' (±Infinity), 'dne' (oscillates: (-1)ⁿ, cos n) or
 * 'unknown' — never a confident guess.
 */
export function sequenceLimit(a: Term, nStart: number): LimitResult {
  const term = guarded(a);
  const { end, overflow, offInts } = definedRange(term, nStart);
  const span = (end - nStart) / (2 * M0);
  const r = Math.min(2, Math.max(R_MIN, span ** (1 / (LIMIT_SAMPLES_PER_SIDE - 1))));
  let t0 = 0;
  const defined = [0, 0]; // finite samples per parity
  let res = computeLimit((x) => {
    t0 ||= Math.abs(x);
    const k = Math.round(Math.log2(t0 / Math.abs(x)));
    const n = nStart + 2 * Math.ceil(M0 * r ** k) + (x < 0 ? 1 : 0);
    const v = n <= end ? term(n) : NaN;
    if (Number.isFinite(v)) defined[x < 0 ? 1 : 0]++;
    return v;
  }, 0);
  if (overflow) {
    // Too few samples for a parity (2^(2^n) overflows at n = 10): computeLimit's 'dne' only means
    // "no points there"; a sign-definite term is ±∞ if trendCheck sees its growth rate hold.
    if (res.status === 'dne' && Math.min(...defined) < MIN_RUN) {
      const sign = oneSign(term, nStart);
      res = sign ? infinite(sign) : UNKNOWN;
    }
    res = trendCheck(term, nStart, end, res);
  } else if (res.status === 'infinite' && !offInts) {
    res = farCheck(term, end, res);
  }
  return res.status === 'dne' ? oscillationCheck(term, nStart, end) : res;
}

/**
 * Σ_{n ≥ nStart} aₙ: 'finite', 'infinite' (±Infinity, terms of one sign that do not go to 0 or
 * a sum that grows without bound), 'dne' (other divergence: Σ(-1)ⁿ) or 'unknown'.
 */
export function seriesSum(a: Term, nStart: number): LimitResult {
  const term = guarded(a);
  if (!Number.isFinite(term(nStart))) return DNE; // undefined where the sum starts
  const lim = sequenceLimit(term, nStart);
  if (lim.status === 'infinite') return lim;
  if (lim.status === 'finite' && lim.value !== 0) return infinite(Math.sign(lim.value));
  if (lim.status === 'dne') {
    const sign = oneSign(term, nStart);
    return sign ? infinite(sign) : DNE;
  }
  // Terms not shown to reach 0 can fake a converged sum: n!/1000ⁿ shrinks until n = 1000.
  if (lim.status === 'unknown') return UNKNOWN;
  // Limit comparison with Σ1/n and Σ1/(n·ln n): if n·aₙ or n·ln n·aₙ → L ≠ 0 (or ±∞), aₙ keeps the
  // sign of L and the series diverges like those.
  for (const w of [(n: number) => n, (n: number) => n * Math.log(n)]) {
    const c = sequenceLimit((n) => w(n) * term(n), nStart);
    if (c.status === 'infinite' || (c.status === 'finite' && c.value !== 0)) {
      return infinite(Math.sign(c.value));
    }
  }

  // Exact zero terms end the sum only if they are not 1/∞ from an overflow that turns NaN later.
  const zerosOk = !definedRange(term, nStart).overflow;
  let s = 0;
  let comp = 0; // Neumaier compensation
  let absSum = 0;
  const finite = (v: number): LimitResult =>
    Number.EPSILON * absSum <= CANCEL_REL * Math.max(1, Math.abs(v))
      ? { value: v, status: 'finite' }
      : UNKNOWN;
  const last = [NaN, NaN, NaN, NaN];
  const sums: number[] = [];
  for (let i = 0, next = N0; i < MAX_TERMS; i++) {
    const v = term(nStart + i);
    if (!Number.isFinite(v)) {
      return geometricTail(last, s + comp, zerosOk) ? finite(s + comp) : UNKNOWN;
    }
    const t = s + v;
    comp += Math.abs(s) >= Math.abs(v) ? s - t + v : v - t + s;
    s = t;
    absSum += Math.abs(v);
    last.shift();
    last.push(v);
    if (i + 1 === next) {
      if (geometricTail(last, s + comp, zerosOk)) return finite(s + comp);
      sums.push(s + comp);
      next *= 2;
    }
  }
  // S(N0·2^k) as a sequence in k, through limit.ts (one-sided at x0 = 0: t_k ∝ 2^-k ∝ 1/N).
  let t0 = 0;
  const res = computeLimit(
    (x) => {
      t0 ||= x;
      const k = Math.round(Math.log2(t0 / x));
      return k < sums.length ? sums[k] : NaN;
    },
    0,
    '+',
  );
  // MAX_TERMS partial sums that have not settled prove nothing (Σ0.9999ⁿ, Σ1/n^1.01 converge).
  return res.status === 'finite' ? finite(res.value) : UNKNOWN;
}

/** S = a(nStart) + … + a(nMax). */
export function partialSum(a: Term, nStart: number, nMax: number): number {
  let s = 0;
  for (let n = nStart; n <= nMax; n++) s += a(n);
  return s;
}

/**
 * Memoized recursive sequence: a(nStart + i) = seeds[i], and past the seeds
 * a(m + order) = next(m, [a(m), …, a(m + order − 1)]).
 */
export function recurrence(
  seeds: readonly number[],
  nStart: number,
  order: number,
  next: (m: number, window: readonly number[]) => number,
): Term {
  const memo = [...seeds];
  return (n) => {
    const i = n - nStart;
    if (!Number.isInteger(i) || i < 0) return NaN;
    while (memo.length <= i) {
      const k = memo.length - order;
      memo.push(next(nStart + k, memo.slice(k, k + order)));
    }
    return memo[i];
  };
}

/** A term that throws is NaN. */
function guarded(a: Term): Term {
  return (n) => {
    try {
      return a(n);
    } catch {
      return NaN;
    }
  };
}

/**
 * Largest n worth sampling: past the last finite probe at nStart + 2^j when every later probe is
 * non-finite (overflow), and RECURRENCE_CAP for terms undefined off the integers (recurrences;
 * also n!, which overflows sooner anyway). (-1)ⁿ is NaN at n + 1/2 but real at n + 1/3.
 */
function definedRange(
  term: Term,
  nStart: number,
): { end: number; overflow: boolean; offInts: boolean } {
  const offInts = Number.isNaN(term(nStart + 0.5)) && Number.isNaN(term(nStart + 1 / 3));
  const cap = nStart + (offInts ? RECURRENCE_CAP : 2 ** PROBE_BITS);
  let lastFinite = NaN;
  let tailBad = false;
  for (let j = 0; j <= PROBE_BITS && nStart + 2 ** j <= cap; j++) {
    const n = nStart + 2 ** j;
    const ok = Number.isFinite(term(n));
    if (ok) lastFinite = n;
    tailBad = !ok && !Number.isNaN(lastFinite);
  }
  return tailBad
    ? { end: lastFinite, overflow: true, offInts }
    : { end: cap, overflow: false, offInts };
}

/**
 * On a range cut short by overflow, a verdict of ±∞ (0) is kept only if the growth rate
 * u(m) = ±ln|aₘ₊ₕ/aₘ|/h at three geometrically spaced m is positive at the end and will stay so:
 * not falling (3ⁿ/n³, n!/6ⁿ), polynomial (m·u constant: −n·ln 3 until 3ⁿ overflows) or falling
 * by geometrically shrinking steps to a clearly positive extrapolated rate. 1000ⁿ/n! grows up to n = 170,
 * but its rate falls by equal steps (ln 1000 − ln n will turn negative): 'unknown'.
 */
function trendCheck(term: Term, nStart: number, end: number, res: LimitResult): LimitResult {
  const zero = res.status === 'finite' && res.value === 0;
  if (res.status !== 'infinite' && !zero) return res;
  const sign = zero ? -1 : 1;
  const rate = (m: number) => {
    const h = 2 * Math.ceil(m / 16); // relative step: the ratio stays clear of rounding
    return (sign * Math.log(Math.abs(term(m + h) / term(m)))) / h;
  };
  const lo = Math.max(nStart, 1);
  let late = Math.floor(end / 1.2);
  while (late > 4 * lo && !Number.isFinite(rate(late))) late = Math.floor(late * 0.9); // underflow
  if (late <= 4 * lo) return UNKNOWN;
  const rho = Math.cbrt(late / lo);
  const m = [lo * rho, late / rho, late].map(Math.round);
  const [u1, u2, u3] = m.map(rate);
  if (!(u3 > 0) || !Number.isFinite(u1) || !Number.isFinite(u2)) return UNKNOWN;
  const poly =
    Math.abs((u3 * m[2]) / (u2 * m[1]) - 1) <= POLY_SLACK &&
    Math.abs(u3 * m[2]) * POLY_RANGE <= m[2];
  const [d1, d2] = [u1 - u2, u2 - u3];
  const q = d2 / d1;
  // Rate settling to a clearly positive constant (cⁿ·n^p); a rate decaying like 1/m extrapolates to
  // ≈ 0 (ln²⁰⁰n/n), which is the polynomial test's business.
  const settling = d1 > 0 && q <= 0.5 && u3 - (d2 * q) / (1 - q) > u3 / 2;
  return u3 >= u2 * (1 - 1e-9) || poly || settling ? res : UNKNOWN; // 1e-9: rounding of a pure cⁿ
}

/**
 * A ±∞ read from n ≤ 4e15 is kept only if the term, sampled at real n with ln n evenly spaced up
 * to FAR_N, keeps growing (or overflows): ln n/n^0.01 and ln³⁰n/n rise over the integer samples
 * but have turned by 1e300. Only refutes, never upgrades: doubles past 2^53 are even integers,
 * so it is run only on terms defined off the integers (not recurrences).
 * shortcut: a turn beyond 1e300 (ln n/n^0.001) is not seen, and rounding noise that is not an
 * exact 0 could read as a turn; both need a log-domain evaluator.
 */
function farCheck(term: Term, end: number, res: LimitResult): LimitResult {
  const sign = Math.sign(res.value);
  const [a, b] = [Math.log(end), Math.log(FAR_N)];
  let prev = sign * term(end);
  for (let i = 1; i <= FAR_SAMPLES; i++) {
    const v = sign * term(Math.exp(a + ((b - a) * i) / FAR_SAMPLES));
    // ∞: overflowed while growing. NaN or exact 0: undefined there, or an intermediate overflow or
    // cancellation (n·n^(-2/3) as n²→∞ gives 0; √(n+1) − √n is 0 past 2^53): nothing to refute.
    if (v === Infinity || Number.isNaN(v) || v === 0) return res;
    if (!(v > prev)) return UNKNOWN;
    prev = v;
  }
  return res;
}

/**
 * computeLimit's 'dne' stands only if the last OSC_BLOCK terms still oscillate (≥ 2 turns) over
 * a range no narrower than an early block's: sin n, (-1)ⁿ. An envelope that shrinks like
 * 1/ln n (sin n/ln n, which → 0) is 'unknown'.
 * shortcut: oscillations slower than the block (sin(n/1000)) read 'unknown'; widen with strides.
 */
function oscillationCheck(term: Term, nStart: number, end: number): LimitResult {
  const k = Math.min(OSC_BLOCK, Math.floor((end - nStart) / 4));
  if (k < MIN_RUN) return UNKNOWN;
  const early = swing(term, nStart + Math.floor((end - nStart) / 1024), k);
  const late = swing(term, end - k + 1, k);
  return late.turns >= 2 && late.spread >= 0.99 * early.spread ? DNE : UNKNOWN;
}

/** Range (max − min) and number of turns of the finite terms among a(from) … a(from + k − 1). */
function swing(term: Term, from: number, k: number): { spread: number; turns: number } {
  const v: number[] = [];
  for (let i = 0; i < k; i++) {
    const x = term(from + i);
    if (Number.isFinite(x)) v.push(x);
  }
  if (v.length < MIN_RUN) return { spread: NaN, turns: 0 };
  let turns = 0;
  for (let i = 2; i < v.length; i++) if ((v[i] - v[i - 1]) * (v[i - 1] - v[i - 2]) < 0) turns++;
  return { spread: Math.max(...v) - Math.min(...v), turns };
}

/** The last terms shrink geometrically and their remainder is negligible next to s. */
function geometricTail(last: number[], s: number, zerosOk: boolean): boolean {
  if (!last.every(Number.isFinite)) return false;
  let worst = 0;
  for (let i = 1; i < last.length; i++) {
    if (last[i] === 0 && !zerosOk) return false;
    const q = last[i] === 0 ? 0 : Math.abs(last[i] / last[i - 1]);
    if (!(q <= GEO_RATIO)) return false;
    worst = Math.max(worst, q);
  }
  const tail = (Math.abs(last[last.length - 1]) * worst) / (1 - worst);
  return tail <= TAIL_EPS * Math.abs(s);
}

/** ±1 when the first SIGN_TERMS defined terms share a sign, else 0. */
function oneSign(term: Term, nStart: number): number {
  let sign = 0;
  for (let i = 0; i < SIGN_TERMS; i++) {
    const v = term(nStart + i);
    if (!Number.isFinite(v) || v === 0) continue;
    if (sign && Math.sign(v) !== sign) return 0;
    sign = Math.sign(v);
  }
  return sign;
}
