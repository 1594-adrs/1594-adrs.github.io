/**
 * Initial-value problems dy/dx = f(x, y), y(x0) = y0. Pure math: no DOM/Angular.
 *
 * `stepIvp` is the textbook table (Euler / classic RK4, fixed step). `solveIvp` is Dormand–Prince
 * 5(4) with FSAL and an elementary step controller (mixed relative/absolute tolerance, safety
 * factor, clamped growth). Each side of x0 is one outward sweep through the sorted targets; a step
 * that would pass the next target is clipped to land on it exactly, so no interpolation error is
 * added. Steps are also capped by the local Lipschitz length LIP_STEP / |∂f/∂y| (one extra
 * evaluation per step), which keeps the solver from stepping over a singular point of the equation
 * where uniqueness is lost (y′ = 2y/x at x = 0, (2y − 1)/(x + 2) at x = −2): it collapses there.
 *
 * A trial step whose stages are not all finite (f NaN/±∞ or threw, y overflowed) is rejected and
 * shrunk, like one with a large error estimate. When the step falls below MIN_STEP_REL·max(1, |x|)
 * (or the step budget runs out) the solution cannot be continued past x:
 *  - 'undefined' when the last rejection was a NaN and the slope at x is tame: f stops being real
 *    there (sqrt(1 − x²) at x = 1, ln x at 0);
 *  - 'blow-up' otherwise: the solution or the slope grows without bound (y′ = y² at its pole,
 *    1/(x·sqrt(x² − 1)) at x = 1, 1/x across 0).
 * Every target beyond the failure gets the same status and NaN.
 */
import type { CompiledExpr } from './evaluator';

export type OdeMethod = 'euler' | 'rk4';

export interface OdeResult {
  /** y at the requested x; NaN when the solution does not reach it. */
  value: number;
  /**
   * 'blow-up': |y| → ∞ or the step size collapses before reaching x (a singularity of f or of
   * the solution); 'undefined': f stops being real on the way (outside its domain).
   */
  status: 'ok' | 'blow-up' | 'undefined';
}

/** Fixed-step tables longer than this are a typo in h, not a textbook exercise. */
const MAX_FIXED_STEPS = 1_000_000;
/** Local tolerances: per-step errors accumulate, this keeps the global error ≲ 1e-9 relative. */
const RTOL = 1e-11;
/** Absolute floor so a solution crossing zero does not force tiny steps. */
const ATOL = 1e-13;
/**
 * Steps (accepted + rejected) per side: bounds the work at ~6 f-evaluations each.
 * shortcut: running out of steps is reported as 'blow-up' although the solution may be smooth (a
 * stiff y′ = −1000(y − cos x) past x ≈ 5, y′ = y over 500 units); add a status if that matters.
 */
const MAX_STEPS = 20_000;
/** A step this small relative to max(1, |x|) is a singularity, not a hard stretch of curve. */
const MIN_STEP_REL = 1e-12;
/** First trial step × max(1, |x0|); the controller grows it at most GROW_MAX per step. */
const H0_REL = 1e-3;
/**
 * No step longer than this × the distance to the last target. Where f ≈ 0 and ∂f/∂y ≈ 0 the error
 * estimate is 0 and h grows ×GROW_MAX per step, so without a cap it leaps over a narrow bump
 * (exp(−30x²) from −10 to 10 read 5e-28).
 * shortcut: a feature narrower than about this × the span can still be stepped over.
 */
const HMAX_REL = 1 / 64;
const SAFETY = 0.9;
const GROW_MAX = 5;
const SHRINK_MIN = 0.2;
/** Shrink after a non-finite stage: bisect toward the trouble point. */
const SHRINK_BAD = 0.5;
/** At a NaN-stop, a slope above this × (1 + |y|) means f itself is blowing up (blow-up). */
const STEEP_SLOPE = 1e4;
/**
 * Steps are also capped at LIP_STEP / |∂f/∂y|. Near a singular point of the equation
 * (|∂f/∂y| ~ p/|x − c|: 2y/x at 0) the cap shrinks steps
 * geometrically onto c, so the solver collapses there instead of stepping across it onto an
 * arbitrary branch (every Cx² solves y′ = 2y/x on x < 0). Misses only p < LIP_STEP.
 */
const LIP_STEP = 0.25;
/** Finite-difference offset for ∂f/∂y, × max(1, |y|). */
const LIP_DELTA = 1e-7;

const fail = (status: OdeResult['status']): OdeResult => ({ value: NaN, status });

/** f with a throw read as NaN. */
function safeF(f: CompiledExpr): (x: number, y: number) => number {
  return (x, y) => {
    try {
      return f(x, y);
    } catch {
      return NaN;
    }
  };
}

/**
 * Fixed-step Euler or classic RK4 from x0 to xEnd with step h (the textbook tables):
 * round(|xEnd − x0| / h) steps of size (xEnd − x0) / steps, so a rounded h lands on xEnd.
 */
export function stepIvp(
  f: CompiledExpr,
  x0: number,
  y0: number,
  xEnd: number,
  method: OdeMethod,
  h: number,
): OdeResult {
  // Books write h < 0 for a table that runs backwards; the direction comes from xEnd.
  const steps = Math.round(Math.abs(xEnd - x0) / Math.abs(h));
  // steps = 0 with xEnd ≠ x0: h is over twice the interval, no table lands on xEnd.
  const empty = steps === 0 && xEnd !== x0;
  if (!(h !== 0) || !Number.isFinite(h) || !(steps <= MAX_FIXED_STEPS) || empty) {
    throw new RangeError(`stepIvp: invalid step h = ${h}`);
  }
  if (steps === 0) return { value: y0, status: 'ok' };
  const F = safeF(f);
  const step = (xEnd - x0) / steps;
  let y = y0;
  for (let i = 0; i < steps; i++) {
    const x = x0 + i * step; // not accumulated, so the table's x values stay exact
    const k1 = F(x, y);
    if (method === 'euler') y += step * k1;
    else {
      const k2 = F(x + step / 2, y + (step / 2) * k1);
      const k3 = F(x + step / 2, y + (step / 2) * k2);
      const k4 = F(x + step, y + step * k3);
      y += (step / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    if (Number.isNaN(y)) return fail('undefined');
    if (!Number.isFinite(y)) return fail('blow-up');
  }
  return { value: y, status: 'ok' };
}

/**
 * Accurate solution (adaptive embedded Runge–Kutta, relative error ≲ 1e-9) at every x in `xs`,
 * on either side of x0; results in the order of `xs`. One sweep per side, so the cost does not
 * grow with xs.length.
 */
export function solveIvp(
  f: CompiledExpr,
  x0: number,
  y0: number,
  xs: readonly number[],
): OdeResult[] {
  const out = new Array<OdeResult>(xs.length);
  const order = xs.map((_, i) => i);
  const right = order.filter((i) => xs[i] >= x0).sort((a, b) => xs[a] - xs[b]);
  const left = order.filter((i) => xs[i] < x0).sort((a, b) => xs[b] - xs[a]);
  const F = safeF(f);
  for (const side of [right, left]) {
    const results = sweep(
      F,
      x0,
      y0,
      side.map((i) => xs[i]),
    );
    side.forEach((i, j) => (out[i] = results[j]));
  }
  for (let i = 0; i < xs.length; i++) out[i] ??= fail('undefined'); // NaN entries in xs
  return out;
}

// Dormand–Prince 5(4) tableau; the 5th-order weights are row 7 (FSAL).
const A21 = 1 / 5;
const [A31, A32] = [3 / 40, 9 / 40];
const [A41, A42, A43] = [44 / 45, -56 / 15, 32 / 9];
const [A51, A52, A53, A54] = [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729];
const [A61, A62, A63, A64, A65] = [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656];
const [B1, B3, B4, B5, B6] = [35 / 384, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84];
/** 5th − 4th order weights: the local error estimate. */
const [E1, E3, E4, E5, E6, E7] = [
  71 / 57600,
  -71 / 16695,
  71 / 1920,
  -17253 / 339200,
  22 / 525,
  -1 / 40,
];

/** |∂f/∂y| at (x, y) by a one-sided difference (the other side at a domain edge in y). */
function lipschitz(F: (x: number, y: number) => number, x: number, y: number, fxy: number): number {
  const d = LIP_DELTA * Math.max(1, Math.abs(y));
  for (const dy of [d, -d]) {
    const L = Math.abs(F(x, y + dy) - fxy) / d;
    if (!Number.isNaN(L)) return L;
  }
  return Infinity; // real on neither side of y: no room to step
}

/** Integrates outward from (x0, y0) through `targets`, sorted in the direction of travel. */
function sweep(
  F: (x: number, y: number) => number,
  x0: number,
  y0: number,
  targets: readonly number[],
): OdeResult[] {
  const res: OdeResult[] = [];
  if (!targets.length) return res;
  const dir = targets[targets.length - 1] >= x0 ? 1 : -1;
  let x = x0;
  let y = y0;
  let k1 = F(x, y);
  let h = H0_REL * Math.max(1, Math.abs(x0));
  const hMax = Math.max(h, HMAX_REL * Math.abs(targets[targets.length - 1] - x0));
  let hLip = Number.isFinite(k1) ? LIP_STEP / lipschitz(F, x, y, k1) : 0;
  let steps = 0;
  let lastBad: 'nan' | 'inf' | 'error' = 'error';
  let failure: OdeResult | null = Number.isFinite(k1)
    ? null
    : fail(Number.isNaN(k1) ? 'undefined' : 'blow-up');

  for (const t of targets) {
    while (!failure && x !== t) {
      if (++steps > MAX_STEPS || Math.min(h, hLip) < MIN_STEP_REL * Math.max(1, Math.abs(x))) {
        const tame = Math.abs(k1) <= STEEP_SLOPE * (1 + Math.abs(y));
        failure = fail(lastBad === 'nan' && tame ? 'undefined' : 'blow-up');
        break;
      }
      const hTry = Math.min(h, hLip, hMax);
      const clipped = hTry >= Math.abs(t - x);
      const xNew = clipped ? t : x + dir * hTry;
      const s = xNew - x;
      const k2 = F(x + s * A21, y + s * A21 * k1);
      const k3 = F(x + s * 0.3, y + s * (A31 * k1 + A32 * k2));
      const k4 = F(x + s * 0.8, y + s * (A41 * k1 + A42 * k2 + A43 * k3));
      const k5 = F(x + (s * 8) / 9, y + s * (A51 * k1 + A52 * k2 + A53 * k3 + A54 * k4));
      const k6 = F(xNew, y + s * (A61 * k1 + A62 * k2 + A63 * k3 + A64 * k4 + A65 * k5));
      const yNew = y + s * (B1 * k1 + B3 * k3 + B4 * k4 + B5 * k5 + B6 * k6);
      const k7 = F(xNew, yNew);
      const sum = k2 + k3 + k4 + k5 + k6 + k7 + yNew;
      if (!Number.isFinite(sum)) {
        // Not Number.isNaN(sum): ∞ − ∞ in the sum would read an overflow as a NaN.
        lastBad = [k2, k3, k4, k5, k6, k7, yNew].some(Number.isNaN) ? 'nan' : 'inf';
        h = Math.abs(s) * SHRINK_BAD;
        continue;
      }
      const errAbs = Math.abs(s * (E1 * k1 + E3 * k3 + E4 * k4 + E5 * k5 + E6 * k6 + E7 * k7));
      const err = errAbs / (ATOL + RTOL * Math.max(Math.abs(y), Math.abs(yNew)));
      const fac = err === 0 ? GROW_MAX : Math.min(GROW_MAX, SAFETY * err ** -0.2);
      if (err <= 1) {
        x = xNew;
        y = yNew;
        k1 = k7;
        hLip = LIP_STEP / lipschitz(F, x, y, k1);
        // A clipped step is short by choice, not by the error: don't let it shrink h.
        h = clipped ? Math.max(h, Math.abs(s) * fac) : Math.abs(s) * fac;
      } else {
        lastBad = 'error';
        h = Math.abs(s) * Math.max(SHRINK_MIN, fac);
      }
    }
    res.push(failure ?? { value: y, status: 'ok' });
  }
  return res;
}
