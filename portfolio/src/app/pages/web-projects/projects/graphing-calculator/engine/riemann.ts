/**
 * Riemann sums and the trapezoid / Simpson rules on n equal subintervals, with the sample points
 * of every panel (for drawing the rectangles, trapezoids and parabolas). Pure math: no DOM/Angular.
 *
 * A non-finite sample is replaced by the limit of f there (sin(x)/x at 0 is a removable hole the
 * book fills in); when that limit is not finite the sum does not exist: status 'undefined',
 * value NaN, `badPoint` = the sample.
 */
import { computeLimit } from './limit';

export type RiemannRule = 'left' | 'right' | 'mid' | 'trap' | 'simpson';

/** One rectangle (1 sample), trapezoid (2: both ends) or Simpson parabola (3: ends and middle). */
export interface RiemannPanel {
  a: number;
  b: number;
  xs: number[];
  ys: number[];
}

export interface RiemannResult {
  value: number;
  status: 'ok' | 'undefined';
  panels: RiemannPanel[];
  badPoint?: number;
}

/** f at x, or its (one-sided at the interval ends) limit when f(x) is not finite. */
function sample(f: (x: number) => number, x: number, a: number, b: number): number {
  let y: number;
  try {
    y = f(x);
  } catch {
    y = NaN;
  }
  if (Number.isFinite(y)) return y;
  const side = x === a ? (a < b ? '+' : '-') : x === b ? (a < b ? '-' : '+') : undefined;
  const lim = computeLimit(f, x, side);
  return lim.status === 'finite' ? lim.value : NaN;
}

/**
 * The `rule` sum of f over [a, b] with n subintervals (n even for Simpson; a > b allowed, giving
 * the signed sum with h < 0). Throws RangeError for an invalid n or non-finite bounds.
 */
export function riemannSum(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number,
  rule: RiemannRule,
): RiemannResult {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a positive integer (${n})`);
  if (rule === 'simpson' && n % 2) throw new RangeError(`Simpson's rule needs an even n (${n})`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new RangeError('bounds must be finite');

  const h = (b - a) / n;
  const node = (i: number) => (i === n ? b : a + i * h);
  const panels: RiemannPanel[] = [];
  let value = 0;
  let badPoint: number | undefined;
  const at = (x: number) => {
    const y = sample(f, x, a, b);
    if (Number.isNaN(y) && badPoint === undefined) badPoint = x;
    return y;
  };

  if (rule === 'simpson') {
    for (let i = 0; i < n; i += 2) {
      const xs = [node(i), a + (i + 1) * h, node(i + 2)];
      const ys = xs.map(at);
      panels.push({ a: xs[0], b: xs[2], xs, ys });
      value += ((2 * h) / 6) * (ys[0] + 4 * ys[1] + ys[2]);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const [lo, hi] = [node(i), node(i + 1)];
      const xs =
        rule === 'left'
          ? [lo]
          : rule === 'right'
            ? [hi]
            : rule === 'mid'
              ? [a + (i + 0.5) * h]
              : [lo, hi];
      const ys = xs.map(at);
      panels.push({ a: lo, b: hi, xs, ys });
      value += rule === 'trap' ? (h * (ys[0] + ys[1])) / 2 : h * ys[0];
    }
  }

  return badPoint === undefined
    ? { value, status: 'ok', panels }
    : { value: NaN, status: 'undefined', panels, badPoint };
}
