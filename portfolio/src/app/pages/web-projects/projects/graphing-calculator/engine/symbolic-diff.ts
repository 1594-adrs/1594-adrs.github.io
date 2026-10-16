/**
 * Symbolic differentiation on the parser AST, plus a printer back to calculator syntax.
 * Pure math: no DOM/Angular.
 *
 * The derivative follows the evaluator's semantics: `u^(p/q)` with odd q is the real odd root
 * (so d/dx root(3,x) = 1/3*x^(-2/3) is real for x < 0), `root(n,u)` is `u^(1/n)`, `logb(b,u)` is
 * `ln(u)/ln(b)`, trig is in radians. Piecewise-constant functions (floor, ceil, round, sign,
 * comparisons) differentiate to 0 and min/max/abs to their branch derivative; the formula is
 * only valid where the function is differentiable — a caller evaluating it at a point must check
 * corners and jumps (see `derivativeAt` in differential.ts). |u|′ is written u·u′/|u| so it is
 * NaN, not a fake 0, at u = 0.
 *
 * Simplification is local and minimal (no CAS): exact rational constant folding, 0/1
 * identities, sign pulling, `c1*(c2*u)`, `(u^m)^n` and `u^m*u^n` with rational exponents. It
 * keeps first and second derivatives readable; higher orders still grow (see the spec).
 */
import type { BinaryOp, ExpressionNode } from './parser';

/** The expression contains a function with no derivative in the engine (gamma, factorial, nPr…). */
export class DifferentiationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DifferentiationError';
  }
}

type Node = ExpressionNode;
type Rational = [p: number, q: number];

const ZERO: Node = { type: 'NumberLiteral', value: 0 };
const ONE: Node = { type: 'NumberLiteral', value: 1 };
const COMPARISONS = new Set(['<', '>', '<=', '>=', '==', '!=']);
/** Folded rationals stay below this so p/q is exact in floating point. */
const MAX_EXACT = 2 ** 40;

// ---------------------------------------------------------------- constructors (with folding)

function num(value: number): Node {
  return { type: 'NumberLiteral', value };
}

function bin(operator: string, left: Node, right: Node): Node {
  return { type: 'BinaryOp', operator, left, right };
}

function call(name: string, arg: Node): Node {
  return { type: 'FunctionCall', name, arg };
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Exact rational value of an integer literal, `p/q` of integer literals, or its negation. */
function rational(n: Node): Rational | null {
  if (n.type === 'NumberLiteral') return Number.isInteger(n.value) ? [n.value, 1] : null;
  if (n.type === 'UnaryOp' && n.operator === '-') {
    const r = rational(n.operand);
    return r && [-r[0], r[1]];
  }
  if (n.type === 'BinaryOp' && n.operator === '/') {
    const a = rational(n.left);
    const b = rational(n.right);
    return a && b && b[0] !== 0 && a[1] === 1 && b[1] === 1 ? [a[0], b[0]] : null;
  }
  return null;
}

/** Node for p/q, reduced; null when it would not be exact. */
function ratNode(p: number, q: number): Node | null {
  if (q === 0 || !Number.isSafeInteger(p) || !Number.isSafeInteger(q)) return null;
  const g = gcd(p, q) || 1;
  let [a, b] = [p / g, q / g];
  if (b < 0) [a, b] = [-a, -b];
  if (Math.abs(a) > MAX_EXACT || b > MAX_EXACT) return null;
  return b === 1 ? num(a) : bin('/', num(a), num(b));
}

function isNum(n: Node, v: number): boolean {
  const r = rational(n);
  return r !== null && r[0] === v * r[1];
}

function isNeg(n: Node): n is { type: 'UnaryOp'; operator: string; operand: Node } {
  return n.type === 'UnaryOp' && n.operator === '-';
}

/** Two plain (non-integer) numbers folded in floating point; null when not both literals. */
function foldLiterals(a: Node, b: Node, op: (p: number, q: number) => number): Node | null {
  if (a.type !== 'NumberLiteral' || b.type !== 'NumberLiteral') return null;
  const v = op(a.value, b.value);
  return Number.isFinite(v) ? num(v) : null;
}

/** −b when b reads as negative (−u, a negative constant or c·u with c < 0), else null. */
function negated(b: Node): Node | null {
  if (isNeg(b)) return b.operand;
  if (b.type === 'NumberLiteral') return b.value < 0 ? num(-b.value) : null;
  const r = rational(b);
  if (r) return r[0] < 0 ? ratNode(-r[0], r[1]) : null;
  const [c, u] = coefficient(b);
  return u && u !== b && negated(c) ? mul(negated(c)!, u) : null;
}

export function neg(a: Node): Node {
  if (a.type === 'NumberLiteral') return num(-a.value);
  if (isNeg(a)) return a.operand;
  const r = rational(a);
  if (r) return ratNode(-r[0], r[1]) ?? { type: 'UnaryOp', operator: '-', operand: a };
  // −(c·u) → (−c)·u keeps signs in the coefficient.
  if (a.type === 'BinaryOp' && a.operator === '*' && coefficient(a)[1] !== a) {
    return mul(neg(a.left), a.right);
  }
  return { type: 'UnaryOp', operator: '-', operand: a };
}

export function add(a: Node, b: Node): Node {
  if (isNum(a, 0)) return b;
  if (isNum(b, 0)) return a;
  const ra = rational(a);
  const rb = rational(b);
  if (ra && rb) {
    const r = ratNode(ra[0] * rb[1] + rb[0] * ra[1], ra[1] * rb[1]);
    if (r) return r;
  }
  const lit = foldLiterals(a, b, (p, q) => p + q);
  if (lit) return lit;
  const nb = negated(b);
  if (nb) return sub(a, nb);
  if (isNeg(a)) return sub(b, a.operand);
  return bin('+', a, b);
}

export function sub(a: Node, b: Node): Node {
  if (isNum(b, 0)) return a;
  if (isNum(a, 0)) return neg(b);
  const ra = rational(a);
  const rb = rational(b);
  if (ra && rb) {
    const r = ratNode(ra[0] * rb[1] - rb[0] * ra[1], ra[1] * rb[1]);
    if (r) return r;
  }
  const lit = foldLiterals(a, b, (p, q) => p - q);
  if (lit) return lit;
  const nb = negated(b);
  if (nb) return add(a, nb);
  return bin('-', a, b);
}

/** Splits `c*u` into its constant factor and the rest (c = 1 when there is none). */
function coefficient(n: Node): [Node, Node | null] {
  if (rational(n) || n.type === 'NumberLiteral') return [n, null];
  if (
    n.type === 'BinaryOp' &&
    n.operator === '*' &&
    (rational(n.left) || n.left.type === 'NumberLiteral')
  ) {
    return [n.left, n.right];
  }
  return [ONE, n];
}

/** `u^e` split as [u, e] (e = 1 for a bare factor). */
function powerParts(n: Node): [Node, Node] {
  if (n.type === 'BinaryOp' && n.operator === '^') return [n.left, n.right];
  return [n, ONE];
}

export function mul(a: Node, b: Node): Node {
  if (isNum(a, 0) || isNum(b, 0)) return ZERO;
  if (isNum(a, 1)) return b;
  if (isNum(b, 1)) return a;
  if (isNum(a, -1)) return neg(b);
  if (isNum(b, -1)) return neg(a);
  if (isNeg(a)) return neg(mul(a.operand, b));
  if (isNeg(b)) return neg(mul(a, b.operand));
  const ra = rational(a);
  const rb = rational(b);
  if (ra && rb) {
    const r = ratNode(ra[0] * rb[0], ra[1] * rb[1]);
    if (r) return r;
  }
  const lit = foldLiterals(a, b, (p, q) => p * q);
  if (lit) return lit;
  // Constants first, and merged: 2*(3*u) → 6*u, u*2 → 2*u.
  const [ca, ua] = coefficient(a);
  const [cb, ub] = coefficient(b);
  const scaled = (c: Node, u: Node): Node => (isNum(c, 1) ? u : bin('*', c, u));
  if (ua && ub && (!isNum(ca, 1) || !isNum(cb, 1))) return scaled(mul(ca, cb), mul(ua, ub));
  if (!ua && ub) return scaled(mul(a, cb), ub);
  if (ua && !ub) return scaled(mul(ca, b), ua);
  // Same base: u^m * u^n → u^(m+n) for rational m, n (u*u → u^2).
  const [ba, ea] = powerParts(a);
  const [bb, eb] = powerParts(b);
  const ma = rational(ea);
  const mb = rational(eb);
  if (ma && mb && sameNode(ba, bb)) return pow(ba, add(ea, eb));
  return bin('*', a, b);
}

export function div(a: Node, b: Node): Node {
  if (isNum(a, 0)) return ZERO;
  if (isNum(b, 1)) return a;
  if (isNum(b, -1)) return neg(a);
  if (isNeg(a)) return neg(div(a.operand, b));
  if (isNeg(b)) return neg(div(a, b.operand));
  const ra = rational(a);
  const rb = rational(b);
  if (ra && rb && rb[0] !== 0) {
    const r = ratNode(ra[0] * rb[1], ra[1] * rb[0]);
    if (r) return r;
  }
  // One fraction bar: (u/v)/w → u/(v·w), (c·u)/v → c·(u/v) so constants stay in front.
  if (a.type === 'BinaryOp' && a.operator === '/') return div(a.left, mul(a.right, b));
  const [ca, ua] = coefficient(a);
  if (ua && !isNum(ca, 1)) return mul(ca, div(ua, b));
  // Same base: u^m / u^n → u^(m−n) for rational m, n (x/x^4 → x^(−3)).
  const [ba, ea] = powerParts(a);
  const [bb, eb] = powerParts(b);
  if (rational(ea) && rational(eb) && sameNode(ba, bb)) return pow(ba, sub(ea, eb));
  return bin('/', a, b);
}

export function pow(base: Node, e: Node): Node {
  if (isNum(e, 0)) return ONE;
  if (isNum(e, 1)) return base;
  const rb = rational(base);
  const re = rational(e);
  if (rb && re && re[1] === 1 && Math.abs(re[0]) <= 64) {
    const k = Math.abs(re[0]);
    const r = re[0] >= 0 ? ratNode(rb[0] ** k, rb[1] ** k) : ratNode(rb[1] ** k, rb[0] ** k);
    if (r) return r;
  }
  // (u^m)^n → u^(m*n) for integer m, n (exact for every real u, unlike fractional powers).
  if (base.type === 'BinaryOp' && base.operator === '^' && re && re[1] === 1) {
    const rm = rational(base.right);
    if (rm && rm[1] === 1) return pow(base.left, mul(base.right, e));
  }
  return bin('^', base, e);
}

// ---------------------------------------------------------------- structure helpers

const depCache = new WeakMap<Node, Map<string, boolean>>();

/** Whether `node` contains the variable `name`. */
export function dependsOn(node: Node, name: string): boolean {
  let m = depCache.get(node);
  const hit = m?.get(name);
  if (hit !== undefined) return hit;
  let r: boolean;
  switch (node.type) {
    case 'NumberLiteral':
      r = false;
      break;
    case 'Variable':
      r = node.name === name;
      break;
    case 'BinaryOp':
      r = dependsOn(node.left, name) || dependsOn(node.right, name);
      break;
    case 'UnaryOp':
      r = dependsOn(node.operand, name);
      break;
    case 'FunctionCall':
      r = dependsOn(node.arg, name);
      break;
    case 'FunctionCallMultiArg':
      r = node.args.some((a) => dependsOn(a, name));
      break;
    case 'PoweredFunctionCall':
      r = dependsOn(node.arg, name) || dependsOn(node.power, name);
      break;
  }
  if (!m) depCache.set(node, (m = new Map()));
  m.set(name, r);
  return r;
}

/** Number of nodes of the expression tree (shared subtrees counted once per use). */
export function countNodes(node: Node): number {
  switch (node.type) {
    case 'NumberLiteral':
    case 'Variable':
      return 1;
    case 'BinaryOp':
      return 1 + countNodes(node.left) + countNodes(node.right);
    case 'UnaryOp':
      return 1 + countNodes(node.operand);
    case 'FunctionCall':
      return 1 + countNodes(node.arg);
    case 'FunctionCallMultiArg':
      return 1 + node.args.reduce((s, a) => s + countNodes(a), 0);
    case 'PoweredFunctionCall':
      return 1 + countNodes(node.arg) + countNodes(node.power);
  }
}

function sameNode(a: Node, b: Node): boolean {
  return a === b || toExpressionString(a) === toExpressionString(b);
}

/** Replaces every variable named in `values` by the given expression. */
export function substitute(node: Node, values: Record<string, Node>): Node {
  switch (node.type) {
    case 'NumberLiteral':
      return node;
    case 'Variable':
      return Object.hasOwn(values, node.name) ? values[node.name] : node;
    case 'BinaryOp':
      return bin(node.operator, substitute(node.left, values), substitute(node.right, values));
    case 'UnaryOp':
      return { ...node, operand: substitute(node.operand, values) };
    case 'FunctionCall':
      return { ...node, arg: substitute(node.arg, values) };
    case 'FunctionCallMultiArg':
      return { ...node, args: node.args.map((a) => substitute(a, values)) };
    case 'PoweredFunctionCall':
      return { ...node, arg: substitute(node.arg, values), power: substitute(node.power, values) };
  }
}

// ---------------------------------------------------------------- differentiation

/** d/d`variable` of `ast`. Other variables (and e, pi) are constants. */
export function differentiate(ast: Node, variable: string): Node {
  const d = (n: Node): Node => (dependsOn(n, variable) ? diff(n) : ZERO);

  const powRule = (u: Node, v: Node): Node => {
    const du = d(u);
    const dv = d(v);
    if (isNum(dv, 0)) {
      // d(u^c) = c·u^(c−1)·u′, with c − 1 kept exact so odd roots stay real.
      const r = rational(v);
      const cm1 = r ? (ratNode(r[0] - r[1], r[1]) ?? sub(v, ONE)) : sub(v, ONE);
      return mul(mul(v, pow(u, cm1)), du);
    }
    const lnU = u.type === 'Variable' && u.name === 'e' ? ONE : call('ln', u);
    const uv = pow(u, v);
    if (isNum(du, 0)) return mul(mul(uv, lnU), dv);
    // General u^v: u^v·(v′·ln u + v·u′/u).
    return mul(uv, add(mul(dv, lnU), div(mul(v, du), u)));
  };

  const chain = (name: string, u: Node): Node => {
    const du = d(u);
    const sq = (x: Node) => pow(x, num(2));
    let outer: Node;
    switch (name) {
      case 'sin':
        outer = call('cos', u);
        break;
      case 'cos':
        outer = neg(call('sin', u));
        break;
      case 'tan':
        outer = sq(call('sec', u));
        break;
      case 'sec':
        outer = mul(call('sec', u), call('tan', u));
        break;
      case 'csc':
        outer = neg(mul(call('csc', u), call('cot', u)));
        break;
      case 'cot':
        outer = neg(sq(call('csc', u)));
        break;
      case 'asin':
        outer = div(ONE, call('sqrt', sub(ONE, sq(u))));
        break;
      case 'acos':
        outer = neg(div(ONE, call('sqrt', sub(ONE, sq(u)))));
        break;
      case 'atan':
        outer = div(ONE, add(ONE, sq(u)));
        break;
      case 'sinh':
        outer = call('cosh', u);
        break;
      case 'cosh':
        outer = call('sinh', u);
        break;
      case 'tanh':
        outer = div(ONE, sq(call('cosh', u)));
        break;
      case 'ln':
        return div(du, u);
      case 'log':
        return div(du, mul(u, call('ln', num(10))));
      case 'sqrt':
        return div(du, mul(num(2), call('sqrt', u)));
      case 'exp':
        outer = call('exp', u);
        break;
      case 'abs':
        // u/|u| rather than sign(u): NaN (not 0) at the corner u = 0.
        outer = div(u, call('abs', u));
        break;
      case 'floor':
      case 'ceil':
      case 'round':
      case 'sign':
        return ZERO;
      default:
        throw new DifferentiationError(`d/d${variable} of ${name}() is not supported`);
    }
    return mul(outer, du);
  };

  const diff = (n: Node): Node => {
    switch (n.type) {
      case 'NumberLiteral':
        return ZERO;
      case 'Variable':
        return n.name === variable ? ONE : ZERO;
      case 'UnaryOp':
        return n.operator === '-' ? neg(d(n.operand)) : d(n.operand);
      case 'BinaryOp':
        return diffBinary(n);
      case 'FunctionCall':
        return chain(n.name, n.arg);
      case 'PoweredFunctionCall':
        return powRule(call(n.name, n.arg), n.power);
      case 'FunctionCallMultiArg':
        return diffMulti(n.name, n.args);
    }
  };

  const diffBinary = (n: BinaryOp): Node => {
    const { left: u, right: v } = n;
    switch (n.operator) {
      case '+':
        return add(d(u), d(v));
      case '-':
        return sub(d(u), d(v));
      case '*':
        return add(mul(d(u), v), mul(u, d(v)));
      case '/': {
        const du = d(u);
        const dv = d(v);
        if (isNum(dv, 0)) return div(du, v);
        // u′/v − u·v′/v²: no squared numerator terms, and the v² merges with later powers of v.
        return sub(div(du, v), div(mul(u, dv), pow(v, num(2))));
      }
      case '^':
        return powRule(u, v);
      default:
        if (COMPARISONS.has(n.operator)) return ZERO;
        throw new DifferentiationError(`operator '${n.operator}' cannot be differentiated`);
    }
  };

  const diffMulti = (name: string, args: Node[]): Node => {
    switch (name) {
      case 'root':
        return d(pow(args[1], div(ONE, args[0])));
      case 'logb':
        return d(div(call('ln', args[1]), call('ln', args[0])));
      case 'atan2': {
        const [y, x] = args;
        return div(sub(mul(x, d(y)), mul(y, d(x))), add(pow(x, num(2)), pow(y, num(2))));
      }
      case 'mod': {
        const [u, m] = args;
        const dm = d(m);
        const floorQ = call('floor', div(u, m));
        return isNum(dm, 0) ? d(u) : sub(d(u), mul(dm, floorQ));
      }
      case 'min':
      case 'max': {
        if (args.length === 1) return d(args[0]);
        const [a, ...rest] = args;
        const r: Node =
          rest.length === 1 ? rest[0] : { type: 'FunctionCallMultiArg', name, args: rest };
        // The branch derivative: (a picked)·a′ + (r picked)·r′; ties are corners.
        const pickA = bin(name === 'min' ? '<=' : '>=', a, r);
        const pickR = bin(name === 'min' ? '>' : '<', a, r);
        return add(mul(pickA, d(a)), mul(pickR, d(r)));
      }
      default:
        throw new DifferentiationError(`d/d${variable} of ${name}() is not supported`);
    }
  };

  return d(ast);
}

// ---------------------------------------------------------------- printer

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
const UNARY_PREC = 3;
const ATOM_PREC = 5;

function precedence(n: Node): number {
  if (n.type === 'BinaryOp') return COMPARISONS.has(n.operator) ? 0 : (PREC[n.operator] ?? 0);
  if (n.type === 'UnaryOp') return UNARY_PREC;
  if (n.type === 'NumberLiteral' && n.value < 0) return UNARY_PREC;
  // `sin(x)^2` binds like a power.
  if (n.type === 'PoweredFunctionCall') return PREC['^'];
  return ATOM_PREC;
}

function formatNumber(v: number): string {
  // Uppercase E: lowercase `e` is Euler's number for the parser.
  return String(v).replace('e+', 'E').replace('e-', 'E-');
}

const printCache = new WeakMap<Node, string>();

/** Calculator syntax for `ast`; `parse` of the result evaluates to the same values. */
export function toExpressionString(ast: Node): string {
  const hit = printCache.get(ast);
  if (hit !== undefined) return hit;
  const s = print(ast);
  printCache.set(ast, s);
  return s;
}

function wrap(n: Node, minPrec: number): string {
  const s = toExpressionString(n);
  return precedence(n) < minPrec ? `(${s})` : s;
}

/** An exponent prints bare only when it is a non-negative number or a name. */
function exponent(n: Node): string {
  const simple = (n.type === 'NumberLiteral' && n.value >= 0) || n.type === 'Variable';
  return simple ? toExpressionString(n) : `(${toExpressionString(n)})`;
}

function print(n: Node): string {
  switch (n.type) {
    case 'NumberLiteral':
      return formatNumber(n.value);
    case 'Variable':
      return n.name;
    case 'UnaryOp':
      return `${n.operator}${wrap(n.operand, UNARY_PREC + 1)}`;
    case 'FunctionCall':
      return `${n.name}(${toExpressionString(n.arg)})`;
    case 'FunctionCallMultiArg':
      return `${n.name}(${n.args.map(toExpressionString).join(', ')})`;
    case 'PoweredFunctionCall':
      return `${n.name}(${toExpressionString(n.arg)})^${exponent(n.power)}`;
    case 'BinaryOp': {
      if (n.operator === '^') {
        // The parser reads a power base as a primary: anything else needs parentheses
        // (including `sin(x)^2`, whose own `^` would swallow the outer exponent).
        const atom =
          (n.left.type === 'NumberLiteral' && n.left.value >= 0) ||
          n.left.type === 'Variable' ||
          n.left.type === 'FunctionCall' ||
          n.left.type === 'FunctionCallMultiArg';
        const base = atom ? toExpressionString(n.left) : `(${toExpressionString(n.left)})`;
        return `${base}^${exponent(n.right)}`;
      }
      const p = precedence(n);
      const sep = p === 0 ? ` ${n.operator} ` : p === 1 ? ` ${n.operator} ` : n.operator;
      // Left-associative: the right operand of − and / (and of any same-level chain) is wrapped.
      const left = wrap(n.left, p === 0 ? 1 : p);
      // + and * are associative: a same-level right operand needs no parentheses.
      const rightMin = p === 0 ? 1 : n.operator === '+' || n.operator === '*' ? p : p + 1;
      const right =
        n.right.type === 'NumberLiteral' && n.right.value < 0
          ? `(${toExpressionString(n.right)})`
          : isNeg(n.right)
            ? `(${toExpressionString(n.right)})`
            : wrap(n.right, rightMin);
      return `${left}${sep}${right}`;
    }
  }
}
