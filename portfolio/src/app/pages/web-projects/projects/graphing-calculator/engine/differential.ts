/**
 * Point derivatives, tangent / normal lines and Newton's method for every curve mode, on top of
 * the symbolic derivative (symbolic-diff.ts). Pure math: no DOM/Angular.
 *
 * Slopes are dy/dx: +Infinity marks a vertical tangent (signed ±Infinity for y = f(x), where the
 * sign is meaningful), NaN a derivative that does not exist (f undefined at the point, a corner or
 * cusp, a jump, 0/0 of the parametric or implicit quotient). A symbolic value at a point is only
 * trusted when the one-sided difference quotients of the function agree with it, so a formula
 * that is finite at a corner (min/max, |u|-type branches) never yields a wrong slope.
 */
import { compileExpression } from './evaluator';
import { findAxisCrossings } from './numeric-utils';
import type { ExpressionNode } from './parser';
import { add, differentiate, div, mul, neg, sub } from './symbolic-diff';

type Node = ExpressionNode;
type Fn1 = (v: number) => number;

/** A curve as the differential tools read it (variable names as in the function rows). */
export type DifferentialCurve =
  /** y = f(x) */
  | { mode: 'explicit'; f: Node }
  /** x = g(y) */
  | { mode: 'explicit-y'; g: Node }
  /** lhs(x, y) = rhs(x, y) */
  | { mode: 'implicit'; lhs: Node; rhs: Node }
  /** (x(t), y(t)); `x` in a component also reads as the parameter, like the evaluator. */
  | { mode: 'parametric'; x: Node; y: Node }
  /** r = r(t) (or r(x)) */
  | { mode: 'polar'; r: Node };

export type DifferentialErrorCode = 'off-curve' | 'no-point' | 'ambiguous-point';

/** The point the caller asked for is not (uniquely) on the curve. */
export class DifferentialError extends Error {
  constructor(
    readonly code: DifferentialErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DifferentialError';
  }
}

/** dⁿy/dxⁿ at a point of the curve. */
export interface CurveSlope {
  x: number;
  y: number;
  /** +Infinity: vertical tangent; NaN: does not exist. */
  value: number;
}

/** y = y0 + slope·(x − x0); vertical (x = x0) when the slope is infinite, undefined when NaN. */
export interface Line {
  x0: number;
  y0: number;
  slope: number;
}

export type NewtonStatus =
  'steps' | 'converged' | 'zero-derivative' | 'undefined' | 'cycle' | 'diverged';

export interface NewtonResult {
  /** The iterate after `steps`, the converged root, or NaN when the method fails. */
  value: number;
  /** x0, x1, … as computed (also on failure, for the UI). */
  iterates: number[];
  status: NewtonStatus;
}

/** Roots of g(y) = x0 (explicit-y) / F(x0, y) = 0 (implicit) are searched in [-W, W]. */
// shortcut: a point outside |y| ≤ 50 is reported as 'no-point'; pass y0 or widen when needed.
const SOLVE_W = 50;
const SOLVE_STEPS = 4000;
/** Offsets (× max(1, |a|)) of the one-sided difference quotients, coarse → fine. */
const H = [1e-3, 1e-4, 1e-5, 1e-6];
/** Relative agreement between the symbolic value and the one-sided quotients. */
const AGREE = 1e-3;
/** |F(x0, y0)| below this × max(1, |lhs|, |rhs|) counts as on the curve. */
const ON_CURVE = 1e-6;
/** A quotient denominator below this × its numerator is zero (vertical tangent). */
const VERTICAL = 1e-9;
const NEWTON_MAX_ITER = 200;

const T: Node = { type: 'Variable', name: 't' };
const ONE: Node = { type: 'NumberLiteral', value: 1 };

// ---------------------------------------------------------------- formulas

/** d/d(parameter): `t` and `x` both bind to the parameter in parametric / polar rows. */
function dParam(n: Node): Node {
  return add(differentiate(n, 't'), differentiate(n, 'x'));
}

function polarXY(r: Node): [Node, Node] {
  return [
    mul(r, { type: 'FunctionCall', name: 'cos', arg: T }),
    mul(r, { type: 'FunctionCall', name: 'sin', arg: T }),
  ];
}

/** Components (in the parameter) of a parametric or polar curve. */
function components(curve: DifferentialCurve & { mode: 'parametric' | 'polar' }): [Node, Node] {
  return curve.mode === 'polar' ? polarXY(curve.r) : [curve.x, curve.y];
}

/**
 * dⁿy/dxⁿ as a formula, for plotting f′ / f″ or comparing answers: in x (explicit), y
 * (explicit-y), x and y (implicit) or the parameter (parametric, polar).
 */
export function slopeFormula(curve: DifferentialCurve, order = 1): Node {
  if (!Number.isInteger(order) || order < 1) throw new RangeError(`order ${order}`);
  switch (curve.mode) {
    case 'explicit': {
      let d = curve.f;
      for (let i = 0; i < order; i++) d = differentiate(d, 'x');
      return d;
    }
    case 'explicit-y': {
      // dy/dx = 1/g′; each further order is d/dy(·)·dy/dx.
      const slope = div(ONE, differentiate(curve.g, 'y'));
      let d = slope;
      for (let i = 1; i < order; i++) d = mul(differentiate(d, 'y'), slope);
      return d;
    }
    case 'implicit': {
      // y′ = −Fx/Fy; d/dx of a formula in x, y is ∂x + ∂y·y′.
      const F = sub(curve.lhs, curve.rhs);
      const slope = neg(div(differentiate(F, 'x'), differentiate(F, 'y')));
      let d = slope;
      for (let i = 1; i < order; i++) {
        d = add(differentiate(d, 'x'), mul(differentiate(d, 'y'), slope));
      }
      return d;
    }
    case 'parametric':
    case 'polar': {
      const [x, y] = components(curve);
      const dx = dParam(x);
      let d = div(dParam(y), dx);
      for (let i = 1; i < order; i++) d = div(dParam(d), dx);
      return d;
    }
  }
}

// ---------------------------------------------------------------- point derivatives

function fn1(n: Node, slot: 'a' | 'b'): Fn1 {
  const f = compileExpression(n);
  return slot === 'a' ? (v) => safe(() => f(v, NaN)) : (v) => safe(() => f(NaN, v));
}

function fn2(n: Node): (x: number, y: number) => number {
  const f = compileExpression(n);
  return (x, y) => safe(() => f(x, y));
}

function safe(f: () => number): number {
  try {
    return f();
  } catch {
    return NaN;
  }
}

/**
 * g′(a), trusting the symbolic value `s` only when the second-order one-sided quotients agree
 * with it from both sides at some offset; NaN at a corner, jump or where g is undefined. A
 * NaN / infinite `s` (0/0 or 1/0 in the formula) is replaced by what both sides converge to:
 * a common finite value (x·|x| at 0) or a common-signed blow-up (x^(1/3) at 0).
 */
export function checkedDerivative(g: Fn1, a: number, s: number): number {
  const g0 = g(a);
  if (!Number.isFinite(g0)) return NaN;
  const scale = Math.max(1, Math.abs(a));
  const sides = H.map((k) => {
    const h = k * scale;
    return [
      (-3 * g0 + 4 * g(a + h) - g(a + 2 * h)) / (2 * h),
      (3 * g0 - 4 * g(a - h) + g(a - 2 * h)) / (2 * h),
    ];
  });
  if (sides.some(([r, l]) => Number.isNaN(r) || Number.isNaN(l))) return NaN;
  const close = (p: number, q: number) =>
    Math.abs(p - q) <= AGREE * Math.max(1, Math.abs(p), Math.abs(q));
  if (Number.isFinite(s)) return sides.some(([r, l]) => close(r, s) && close(l, s)) ? s : NaN;

  const [r1, l1] = sides[sides.length - 2];
  const [r, l] = sides[sides.length - 1];
  if (close(r, l) && close(r, r1) && close(l, l1)) return (r + l) / 2;
  const sign = Math.sign(r);
  const blowsUp = (i: 0 | 1) =>
    sides.every((q) => Math.sign(q[i]) === sign) &&
    Math.abs(sides[sides.length - 1][i]) >= 10 * Math.abs(sides[0][i]);
  return sign !== 0 && blowsUp(0) && blowsUp(1) ? sign * Infinity : NaN;
}

/** q = num/den with a vanishing denominator read as a vertical tangent (+∞) or 0/0 (NaN). */
function quotient(num: number, den: number): number {
  if (Number.isNaN(num) || Number.isNaN(den)) return NaN;
  if (!Number.isFinite(num)) return Number.isFinite(den) ? Infinity : NaN;
  if (!Number.isFinite(den)) return 0;
  if (num === 0 && den === 0) return NaN;
  if (Math.abs(den) <= VERTICAL * Math.abs(num)) return Infinity;
  return num / den;
}

/** The unique root of h(v) = 0 in [-W, W], or a DifferentialError. */
function uniqueRoot(h: Fn1, what: string): number {
  const roots = findAxisCrossings(h, -SOLVE_W, SOLVE_W, 0, SOLVE_STEPS);
  if (roots.length === 0) throw new DifferentialError('no-point', `no point with ${what}`);
  if (roots.length > 1) {
    throw new DifferentialError(
      'ambiguous-point',
      `${roots.length} points with ${what}: give y0 (${roots.map((v) => +v.toFixed(6)).join(', ')})`,
    );
  }
  return roots[0];
}

/**
 * dⁿy/dxⁿ at the curve point given by `at`: x for explicit / explicit-y / implicit curves, the
 * parameter (angle for polar) otherwise. Implicit and explicit-y curves take `y0` or solve
 * F(x0, y) = 0 / g(y) = x0 for a unique y.
 */
export function slopeAt(
  curve: DifferentialCurve,
  at: number,
  opts: { y0?: number; order?: number } = {},
): CurveSlope {
  const order = opts.order ?? 1;
  const formula = slopeFormula(curve, order);
  switch (curve.mode) {
    case 'explicit': {
      const f = fn1(curve.f, 'a');
      // Each lower derivative must exist (and agree with its one-sided quotients) at the point.
      let g = f;
      let gNode = curve.f;
      let value = NaN;
      for (let i = 0; i < order; i++) {
        const dNode = i === order - 1 ? formula : differentiate(gNode, 'x');
        const d = fn1(dNode, 'a');
        value = checkedDerivative(g, at, d(at));
        if (!Number.isFinite(value) && i < order - 1) value = NaN;
        if (Number.isNaN(value)) break;
        g = d;
        gNode = dNode;
      }
      return { x: at, y: f(at), value };
    }
    case 'explicit-y': {
      const g = fn1(curve.g, 'b');
      const y = opts.y0 ?? uniqueRoot((v) => g(v) - at, `x = ${at}`);
      if (!(Math.abs(g(y) - at) <= ON_CURVE * Math.max(1, Math.abs(at)))) {
        throw new DifferentialError('off-curve', `(${at}, ${y}) is not on the curve`);
      }
      const gp = checkedDerivative(g, y, fn1(differentiate(curve.g, 'y'), 'b')(y));
      // shortcut: orders ≥ 2 evaluate the formula without the one-sided check; add it if a
      // dataset case needs a corner at order 2.
      const value = order === 1 ? quotient(1, gp) : Number.isNaN(gp) ? NaN : fn1(formula, 'b')(y);
      return { x: at, y, value };
    }
    case 'implicit': {
      const F = fn2(sub(curve.lhs, curve.rhs));
      const y = opts.y0 ?? uniqueRoot((v) => F(at, v), `x = ${at}`);
      const lhs = fn2(curve.lhs)(at, y);
      const rhs = fn2(curve.rhs)(at, y);
      const scale = Math.max(1, Math.abs(lhs), Math.abs(rhs));
      if (!(Math.abs(lhs - rhs) <= ON_CURVE * scale)) {
        throw new DifferentialError('off-curve', `(${at}, ${y}) is not on the curve`);
      }
      const G = sub(curve.lhs, curve.rhs);
      const slope = quotient(-fn2(differentiate(G, 'x'))(at, y), fn2(differentiate(G, 'y'))(at, y));
      // shortcut: implicit slopes are not checked against one-sided quotients (a corner of an
      // implicit curve is a singular point, Fx = Fy = 0, caught above); order ≥ 2 likewise.
      const value = order === 1 ? slope : Number.isFinite(slope) ? fn2(formula)(at, y) : NaN;
      return { x: at, y, value };
    }
    case 'parametric':
    case 'polar': {
      const [xNode, yNode] = components(curve);
      const X = fn1(xNode, 'a');
      const Y = fn1(yNode, 'a');
      const xp = checkedDerivative(X, at, fn1(dParam(xNode), 'a')(at));
      const yp = checkedDerivative(Y, at, fn1(dParam(yNode), 'a')(at));
      const slope = quotient(yp, xp);
      // shortcut: orders ≥ 2 evaluate (dS/dt)/x′ without the one-sided check.
      const value = order === 1 ? slope : Number.isFinite(slope) ? fn1(formula, 'a')(at) : NaN;
      return { x: X(at), y: Y(at), value };
    }
  }
}

// ---------------------------------------------------------------- lines

/** Tangent (or normal) line at the curve point given by `at` (see `slopeAt`). */
export function tangentLine(
  curve: DifferentialCurve,
  at: number,
  opts: { y0?: number; normal?: boolean } = {},
): Line {
  const { x, y, value } = slopeAt(curve, at, { y0: opts.y0 });
  if (!opts.normal) return { x0: x, y0: y, slope: value };
  const slope = Number.isNaN(value)
    ? NaN
    : value === 0
      ? Infinity
      : Number.isFinite(value)
        ? -1 / value
        : 0;
  return { x0: x, y0: y, slope };
}

/** y of a line at x; NaN for a vertical or undefined line. */
export function lineAt(line: Line, x: number): number {
  return Number.isFinite(line.slope) ? line.y0 + line.slope * (x - line.x0) : NaN;
}

// ---------------------------------------------------------------- Newton

/**
 * Newton's method on y = f(x) from x0: the iterate after `steps`, or (steps omitted) the root it
 * converges to. Fails (NaN) on f′ = 0, f undefined, a 2-cycle or no convergence.
 */
export function newton(f: Node, x0: number, steps?: number): NewtonResult {
  const F = fn1(f, 'a');
  const D = fn1(differentiate(f, 'x'), 'a');
  const iterates = [x0];
  const fail = (status: NewtonStatus): NewtonResult => ({ value: NaN, iterates, status });
  const near = (p: number, q: number, rel: number) =>
    Math.abs(p - q) <= rel * Math.max(1, Math.abs(p));
  let x = x0;
  for (let i = 0; i < (steps ?? NEWTON_MAX_ITER); i++) {
    const fx = F(x);
    if (!Number.isFinite(fx)) return fail('undefined');
    if (fx === 0 && steps === undefined) return { value: x, iterates, status: 'converged' };
    let next = x;
    if (fx !== 0) {
      const dx = D(x);
      if (!Number.isFinite(dx)) return fail('undefined');
      if (dx === 0) return fail('zero-derivative');
      next = x - fx / dx;
    }
    if (!Number.isFinite(next) || Math.abs(next) > 1e15) return fail('diverged');
    iterates.push(next);
    if (steps === undefined) {
      if (near(next, x, 1e-12)) return { value: next, iterates, status: 'converged' };
      const back2 = iterates[iterates.length - 3];
      if (back2 !== undefined && near(next, back2, 1e-9) && !near(next, x, 1e-6)) {
        return fail('cycle');
      }
    }
    x = next;
  }
  return steps === undefined ? fail('diverged') : { value: x, iterates, status: 'steps' };
}
