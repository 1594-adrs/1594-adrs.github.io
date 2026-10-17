/**
 * Taylor polynomials by truncated power-series (Taylor-mode) arithmetic on the parser AST: every
 * node evaluates to its coefficient array at the center, so order k costs O(k²) per node instead
 * of the expression-tree blow-up of repeated symbolic differentiation. Pure math: no DOM/Angular.
 *
 * Semantics follow the evaluator (and symbolic-diff.ts): `u^(p/q)` with odd q is the real odd
 * root, `root(n,u)` is `u^(1/n)`, `logb(b,u)` is `ln u / ln b`, `log` is base 10, radians. A
 * subtree without x is evaluated by the evaluator and becomes a constant series, so factorial(5)
 * or ncr(5,2) are fine; only x-dependent functions without a series throw `TaylorError`.
 *
 * Rules: + − · ÷ by Cauchy product / series division; `u^c` with integer c by repeated squaring,
 * other constant c by the recurrence u·w′ = c·w·u′; general `u^v` = exp(v·ln u); exp, ln,
 * sin/cos, sinh/cosh by their ODE recurrences (tan, sec… as quotients); asin, acos, atan, atan2
 * by integrating the series of their derivative. abs, min, max pick the analytic branch (or NaN
 * at a corner); floor, ceil, round, sign and comparisons are constant away from a jump, NaN on it.
 *
 * A "zero" leading coefficient is one below ZERO_TOL × the next terms (sin(π) ≈ 1.2e-16). Each
 * series carries only its valid terms: dividing two series that both vanish at the center (sin x
 * / x) cancels the common factor and loses terms, so the whole expansion is redone with guard
 * terms until `order + 1` are valid. Not analytic at the center (pole, √ or ln of 0, corner,
 * jump) → every coefficient is NaN.
 *
 * shortcut: there are no Laurent series, so poles never cancel across operations: x·cot(x) and
 * cot(x) − 1/x are NaN at 0 (x/tan(x) works). Add negative powers if a case needs it.
 */
import { evaluate } from './evaluator';
import type { ExpressionNode } from './parser';
import { dependsOn } from './symbolic-diff';

/** The expression contains a function with no power series in the engine (floor, factorial…). */
export class TaylorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaylorError';
  }
}

type Series = number[];

/** A coefficient below this × the largest of it and its next ZERO_WINDOW − 1 terms is 0. */
const ZERO_TOL = 1e-12;
const ZERO_WINDOW = 3;
/** Most extra working terms spent on removable singularities (sin x / x needs 1). */
const MAX_GUARD = 16;
const COMPARISONS = new Set(['<', '>', '<=', '>=', '==', '!=']);

/**
 * Coefficients c_0..c_order of f(x) ≈ Σ c_k (x − center)^k, f in the variable `x`. Coefficients
 * are NaN where f is not analytic at the center (√x at 0, |x| at 0, a pole).
 */
export function taylorCoefficients(ast: ExpressionNode, center: number, order: number): number[] {
  if (!Number.isInteger(order) || order < 0) {
    throw new RangeError(`Taylor order must be a non-negative integer, got ${order}`);
  }
  const want = order + 1;
  if (!Number.isFinite(center)) return nans(want);
  let guard = 0;
  for (;;) {
    const s = expand(ast, center, want + guard);
    if (s.length >= want) return s.slice(0, want);
    if (guard >= MAX_GUARD) return [...s, ...nans(want - s.length)];
    guard = Math.min(MAX_GUARD, guard + want - s.length);
  }
}

// ---------------------------------------------------------------- series arithmetic

function nans(n: number): Series {
  return new Array<number>(n).fill(NaN);
}

/** Leading coefficients of `s` that are rounding residue (all of them for s ≡ 0). */
function leadingZeros(s: Series): number {
  for (let k = 0; k < s.length; k++) {
    let scale = 0;
    for (let j = k; j < Math.min(s.length, k + ZERO_WINDOW); j++) {
      scale = Math.max(scale, Math.abs(s[j]));
    }
    if (!(Math.abs(s[k]) <= ZERO_TOL * scale)) return k;
  }
  return s.length;
}

function add(a: Series, b: Series, sign = 1): Series {
  const n = Math.min(a.length, b.length);
  return Array.from({ length: n }, (_, k) => a[k] + sign * b[k]);
}

function scale(a: Series, c: number): Series {
  return a.map((v) => v * c);
}

function mul(a: Series, b: Series): Series {
  const n = Math.min(a.length, b.length);
  const r = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) for (let j = 0; j <= k; j++) r[k] += a[j] * b[k - j];
  return r;
}

/**
 * a / b. A common zero of order v at the center cancels (and costs v terms); a pole is NaN. A
 * denominator with no nonzero term in reach is unknown yet ([]: ask for guard terms).
 */
function div(a: Series, b: Series, n: number): Series {
  const v = leadingZeros(b);
  if (v === b.length) return [];
  if (v > 0) {
    const za = leadingZeros(a);
    if (za < v && za < a.length) return nans(n);
    a = a.slice(v);
    b = b.slice(v);
  }
  const len = Math.min(a.length, b.length);
  const q = new Array<number>(len);
  for (let k = 0; k < len; k++) {
    let s = a[k];
    for (let j = 1; j <= k; j++) s -= b[j] * q[k - j];
    q[k] = s / b[0];
  }
  return q;
}

function deriv(u: Series): Series {
  return u.slice(1).map((v, k) => (k + 1) * v);
}

/** The series with value c0 and derivative series d. */
function integrate(c0: number, d: Series): Series {
  if (d.length > 0 && !Number.isFinite(d[0])) return nans(d.length + 1);
  return [c0, ...d.map((v, k) => v / (k + 1))];
}

function isConstant(u: Series): boolean {
  return u.every((v, k) => k === 0 || v === 0);
}

function exp(u: Series): Series {
  const w = [Math.exp(u[0])];
  for (let k = 1; k < u.length; k++) {
    let s = 0;
    for (let j = 1; j <= k; j++) s += j * u[j] * w[k - j];
    w.push(s / k);
  }
  return w;
}

function ln(u: Series, n: number): Series {
  if (leadingZeros(u) > 0 || !(u[0] > 0)) return nans(n);
  const w = [Math.log(u[0])];
  for (let k = 1; k < u.length; k++) {
    let s = 0;
    for (let j = 1; j < k; j++) s += j * w[j] * u[k - j];
    w.push((u[k] - s / k) / u[0]);
  }
  return w;
}

/** [sin u, cos u] (sign −1) or [sinh u, cosh u] (sign +1): s′ = c·u′, c′ = ∓s·u′. */
function sinCos(u: Series, hyperbolic: boolean): [Series, Series] {
  const s = [hyperbolic ? Math.sinh(u[0]) : Math.sin(u[0])];
  const c = [hyperbolic ? Math.cosh(u[0]) : Math.cos(u[0])];
  const sign = hyperbolic ? 1 : -1;
  for (let k = 1; k < u.length; k++) {
    let ss = 0;
    let cs = 0;
    for (let j = 1; j <= k; j++) {
      ss += j * u[j] * c[k - j];
      cs += j * u[j] * s[k - j];
    }
    s.push(ss / k);
    c.push((sign * cs) / k);
  }
  return [s, c];
}

/** u^r for a constant r with the evaluator's value at the center (real odd roots). */
function powConst(u: Series, r: number, n: number): Series {
  if (Number.isInteger(r)) {
    if (r < 0) return div(constant(1, n), powConst(u, -r, n), n);
    let result = constant(1, u.length);
    let base = u;
    for (let e = r; e > 0; e = Math.floor(e / 2)) {
      if (e % 2) result = mul(result, base);
      if (e > 1) base = mul(base, base);
    }
    return result;
  }
  // shortcut: u(center) = 0 with a fractional power is NaN even when analytic ((x^3)^(1/3) = x);
  // factor out the zero of u if a case needs it.
  if (leadingZeros(u) > 0) return nans(n);
  const w = [evalPow(u[0], r)];
  for (let k = 1; k < u.length; k++) {
    let s = 0;
    for (let j = 1; j <= k; j++) s += ((r + 1) * j - k) * u[j] * w[k - j];
    w.push(s / (k * u[0]));
  }
  return w;
}

function evalPow(base: number, exponent: number): number {
  return evaluate(
    {
      type: 'BinaryOp',
      operator: '^',
      left: { type: 'NumberLiteral', value: base },
      right: { type: 'NumberLiteral', value: exponent },
    },
    {},
  );
}

function pow(u: Series, v: Series, n: number): Series {
  if (!u.length || !v.length) return [];
  if (isConstant(v)) return powConst(u, v[0], n);
  return exp(mul(v, ln(u, n)));
}

function constant(c: number, n: number): Series {
  if (!Number.isFinite(c)) return nans(n);
  const s = new Array<number>(n).fill(0);
  s[0] = c;
  return s;
}

/**
 * The analytic branch of a function that is `a` where d > 0 and `b` where d < 0 (abs, min, max).
 * A zero of d of even order keeps one side; an odd one is a corner.
 */
function branch(d: Series, a: Series, b: Series, n: number): Series {
  const z = leadingZeros(d);
  if (z === d.length) return a;
  if (z > 0 && z % 2 === 1) return nans(n);
  return d[z] > 0 ? a : b;
}

/**
 * A piecewise-constant function with `value` at the center that jumps where d = 0: constant
 * when d(center) ≠ 0 or d ≡ 0, NaN on a jump.
 */
function step(d: Series, value: number, n: number): Series {
  const z = leadingZeros(d);
  // shortcut: a zero of d of even order may still be locally constant (floor(x^2) at 0 from the
  // right side's view); treated as a jump.
  return z === 0 || z === d.length ? constant(value, n) : nans(n);
}

function shift(u: Series, c: number): Series {
  return [u[0] - c, ...u.slice(1)];
}

// ---------------------------------------------------------------- AST walk

function expand(ast: ExpressionNode, center: number, n: number): Series {
  const walk = (node: ExpressionNode): Series => {
    if (!dependsOn(node, 'x')) return constant(evaluate(node, {}), n);
    const s = walkNode(node);
    // A series with no valid term left asks for guard terms; a non-finite value is final.
    return s.length === 0 || Number.isFinite(s[0]) ? s : nans(n);
  };

  const walkNode = (node: ExpressionNode): Series => {
    switch (node.type) {
      case 'NumberLiteral':
        return constant(node.value, n);
      case 'Variable': {
        const s = constant(center, n);
        if (n > 1) s[1] = 1;
        return s;
      }
      case 'UnaryOp':
        return node.operator === '-' ? scale(walk(node.operand), -1) : walk(node.operand);
      case 'BinaryOp':
        return binary(node.operator, walk(node.left), walk(node.right));
      case 'FunctionCall':
        return fn(node.name, walk(node.arg));
      case 'PoweredFunctionCall':
        return pow(fn(node.name, walk(node.arg)), walk(node.power), n);
      case 'FunctionCallMultiArg':
        if (node.name === 'if') return branchAt(node.args);
        return multi(node.name, node.args.map(walk));
    }
  };

  // The branch selected at the center; NaN on the boundary (even a removable one: shortcut,
  // if(x != 0, sin(x)/x, 1) at 0 is NaN — upgrade with a one-sided series if exercises need it).
  const branchAt = ([c, a, b]: ExpressionNode[]): Series => {
    const cond = walk(c);
    if (!cond.length) return [];
    const z = leadingZeros(cond);
    if (Number.isNaN(cond[0]) || (z > 0 && z < cond.length)) return nans(n);
    if (cond[0] !== 0) return walk(a);
    return b ? walk(b) : nans(n);
  };

  // A function of a series with no valid term has none either ([] asks for guard terms).
  const binary = (op: string, a: Series, b: Series): Series => {
    if (!a.length || !b.length) return [];
    switch (op) {
      case '+':
        return add(a, b);
      case '-':
        return add(a, b, -1);
      case '*':
        return mul(a, b);
      case '/':
        return div(a, b, n);
      case '^':
        return pow(a, b, n);
    }
    if (COMPARISONS.has(op)) {
      const value = evaluate(
        {
          type: 'BinaryOp',
          operator: op,
          left: { type: 'NumberLiteral', value: a[0] },
          right: { type: 'NumberLiteral', value: b[0] },
        },
        {},
      );
      return step(add(a, b, -1), value, n);
    }
    throw new TaylorError(`operator '${op}' has no Taylor series`);
  };

  const floorLike = (u: Series, f: (v: number) => number, jump: number): Series =>
    step(shift(u, jump), f(u[0]), n);

  const fn = (name: string, u: Series): Series => {
    if (!u.length) return [];
    switch (name) {
      case 'exp':
        return exp(u);
      case 'ln':
        return ln(u, n);
      case 'log':
        return scale(ln(u, n), 1 / Math.LN10);
      case 'sqrt':
        return powConst(u, 0.5, n);
      case 'sin':
        return sinCos(u, false)[0];
      case 'cos':
        return sinCos(u, false)[1];
      case 'tan': {
        const [s, c] = sinCos(u, false);
        return div(s, c, n);
      }
      case 'sec':
        return div(constant(1, n), sinCos(u, false)[1], n);
      case 'csc':
        return div(constant(1, n), sinCos(u, false)[0], n);
      case 'cot': {
        const [s, c] = sinCos(u, false);
        return div(c, s, n);
      }
      case 'sinh':
        return sinCos(u, true)[0];
      case 'cosh':
        return sinCos(u, true)[1];
      case 'tanh': {
        const [s, c] = sinCos(u, true);
        return div(s, c, n);
      }
      case 'sech':
        return div(constant(1, n), sinCos(u, true)[1], n);
      case 'csch':
        return div(constant(1, n), sinCos(u, true)[0], n);
      case 'coth': {
        const [s, c] = sinCos(u, true);
        return div(c, s, n);
      }
      case 'cbrt':
        return powConst(u, 1 / 3, n);
      case 'asinh':
        return integrate(
          Math.asinh(u[0]),
          div(deriv(u), powConst(add(constant(1, n), mul(u, u)), 0.5, n), n),
        );
      case 'acosh':
        // NaN below 1 (the evaluator's domain); the guard in walk() turns a NaN center into nans.
        return integrate(
          Math.acosh(u[0]),
          div(deriv(u), powConst(add(mul(u, u), constant(1, n), -1), 0.5, n), n),
        );
      case 'atanh':
        return Math.abs(u[0]) >= 1
          ? nans(n)
          : integrate(Math.atanh(u[0]), div(deriv(u), add(constant(1, n), mul(u, u), -1), n));
      case 'asin':
      case 'acos': {
        // (asin u)′ = u′/√(1 − u²), acos = π/2 − asin.
        const d = div(deriv(u), powConst(add(constant(1, n), mul(u, u), -1), 0.5, n), n);
        return name === 'asin'
          ? integrate(Math.asin(u[0]), d)
          : integrate(Math.acos(u[0]), scale(d, -1));
      }
      case 'atan':
        return integrate(Math.atan(u[0]), div(deriv(u), add(constant(1, n), mul(u, u)), n));
      case 'abs':
        return branch(u, u, scale(u, -1), n);
      case 'floor':
        return floorLike(u, Math.floor, Math.round(u[0]));
      case 'ceil':
        return floorLike(u, Math.ceil, Math.round(u[0]));
      case 'round':
        return floorLike(u, Math.round, Math.floor(u[0]) + 0.5);
      case 'sign':
        return floorLike(u, Math.sign, 0);
    }
    throw new TaylorError(`${name}() has no Taylor series`);
  };

  const multi = (name: string, args: Series[]): Series => {
    if (args.some((a) => !a.length)) return [];
    switch (name) {
      case 'root':
        return pow(args[1], div(constant(1, n), args[0], n), n);
      case 'logb':
        return div(ln(args[1], n), ln(args[0], n), n);
      case 'min':
      case 'max':
        return args.reduce((a, b) =>
          name === 'min' ? branch(add(a, b, -1), b, a, n) : branch(add(a, b, -1), a, b, n),
        );
      case 'mod': {
        // ((u % m) + m) % m = u − m·floor(u/m).
        const [u, m] = args;
        const q = div(u, m, n);
        return add(u, mul(m, floorLike(q, Math.floor, Math.round(q[0]))), -1);
      }
      case 'atan2': {
        const [y, x] = args;
        // On the branch cut (x < 0, y = 0) or at the origin atan2 is not analytic.
        if (leadingZeros(y) > 0 && !(x[0] > 0 && leadingZeros(x) === 0)) return nans(n);
        const d = div(add(mul(x, deriv(y)), mul(y, deriv(x)), -1), add(mul(x, x), mul(y, y)), n);
        return integrate(Math.atan2(y[0], x[0]), d);
      }
    }
    throw new TaylorError(`${name}() has no Taylor series`);
  };

  return walk(ast);
}
