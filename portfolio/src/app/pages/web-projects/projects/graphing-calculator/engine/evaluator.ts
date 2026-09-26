import type { ExpressionNode } from './parser';
import { parse } from './parser';

const CONSTANTS: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
  π: Math.PI,
};

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function gamma(x: number): number {
  if (x < 0.5) {
    return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  }
  x -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}

const TRIG_FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot']);
const INVERSE_TRIG_FUNCTIONS = new Set(['asin', 'acos', 'atan']);

const FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  cot: (x) => 1 / Math.tan(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  factorial,
  gamma,
};

/**
 * Approximates `value` as a reduced fraction p/q via continued fractions
 * (q <= maxDenom), so real odd-root results can be detected for expressions
 * like `(-8)^(1/3)`. Returns null when no such fraction matches within `tol`.
 */
function approximateRational(
  value: number,
  maxDenom = 99,
  tol = 1e-10,
): { p: number; q: number } | null {
  if (!isFinite(value)) return null;
  const sign = value < 0 ? -1 : 1;
  const target = Math.abs(value);

  let hPrev2 = 0;
  let hPrev1 = 1;
  let kPrev2 = 1;
  let kPrev1 = 0;
  let x = target;

  for (let i = 0; i < 64; i++) {
    const a = Math.floor(x);
    const h = a * hPrev1 + hPrev2;
    const k = a * kPrev1 + kPrev2;
    if (k > maxDenom) break;

    hPrev2 = hPrev1;
    hPrev1 = h;
    kPrev2 = kPrev1;
    kPrev1 = k;

    if (k > 0 && Math.abs(target - h / k) <= tol) {
      return { p: sign * h, q: k };
    }

    const frac = x - a;
    if (frac < 1e-15) break;
    x = 1 / frac;
  }

  return null;
}

/**
 * Real-valued `base ^ exponent`. For a negative base with a non-integer
 * exponent, approximates the exponent as p/q: an odd denominator has a real
 * (odd) root, so the result is sign(-1)^p * |base|^exponent; an even
 * denominator has no real root, so it's NaN (matching Math.pow's default).
 */
function signedRealPow(base: number, exponent: number): number {
  if (base >= 0 || Number.isInteger(exponent)) {
    return Math.pow(base, exponent);
  }
  const rational = approximateRational(exponent);
  if (!rational) return NaN;
  if (rational.q % 2 === 0) return NaN;
  const sign = rational.p % 2 === 0 ? 1 : -1;
  return sign * Math.pow(Math.abs(base), exponent);
}

const MULTI_ARG_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  mod: (...args) => ((args[0] % args[1]) + args[1]) % args[1],
  logb: (base, x) => Math.log(x) / Math.log(base),
  root: (n, x) => signedRealPow(x, 1 / n),
  atan2: (y, x) => Math.atan2(y, x),
};

function nPr(n: number, r: number): number {
  if (r < 0 || r > n) return NaN;
  return factorial(n) / factorial(n - r);
}

function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return NaN;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

const TWO_ARG_FUNCTIONS: Record<string, (a: number, b: number) => number> = {
  npr: nPr,
  ncr: nCr,
};

const MAX_EVAL_STEPS = 10000;

export function evaluate(
  ast: ExpressionNode,
  variables: Record<string, number>,
  angleUnit: 'rad' | 'deg' = 'rad',
): number {
  let steps = 0;

  function evalNode(node: ExpressionNode): number {
    steps++;
    if (steps > MAX_EVAL_STEPS) {
      throw new Error('Expression evaluation exceeded maximum steps');
    }

    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'Variable':
        if (Object.hasOwn(variables, node.name)) return variables[node.name];
        if (Object.hasOwn(CONSTANTS, node.name)) return CONSTANTS[node.name];
        throw new Error(`Unknown variable: '${node.name}'`);

      case 'BinaryOp': {
        const left = evalNode(node.left);
        const right = evalNode(node.right);
        switch (node.operator) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            return left / right;
          case '^':
            return signedRealPow(left, right);
          case '<':
            return left < right ? 1 : 0;
          case '>':
            return left > right ? 1 : 0;
          case '<=':
            return left <= right ? 1 : 0;
          case '>=':
            return left >= right ? 1 : 0;
          case '==':
            return left === right ? 1 : 0;
          case '!=':
            return left !== right ? 1 : 0;
          default:
            throw new Error(`Unknown operator: '${node.operator}'`);
        }
      }

      case 'UnaryOp': {
        const operand = evalNode(node.operand);
        return node.operator === '-' ? -operand : operand;
      }

      case 'FunctionCall': {
        const fn = FUNCTIONS[node.name];
        if (!fn) throw new Error(`Unknown function: '${node.name}'`);
        let arg = evalNode(node.arg);

        if (TRIG_FUNCTIONS.has(node.name) && angleUnit === 'deg') {
          arg = (arg * Math.PI) / 180;
        }

        const result = fn(arg);

        if (INVERSE_TRIG_FUNCTIONS.has(node.name) && angleUnit === 'deg') {
          return (result * 180) / Math.PI;
        }
        return result;
      }

      case 'FunctionCallMultiArg': {
        const mfn = MULTI_ARG_FUNCTIONS[node.name];
        if (mfn) {
          let result = mfn(...node.args.map((a) => evalNode(a)));
          if (node.name === 'atan2' && angleUnit === 'deg') {
            result = (result * 180) / Math.PI;
          }
          return result;
        }
        const tfn = TWO_ARG_FUNCTIONS[node.name];
        if (tfn) {
          return tfn(evalNode(node.args[0]), evalNode(node.args[1]));
        }
        throw new Error(`Unknown function: '${node.name}'`);
      }

      case 'PoweredFunctionCall': {
        const fn = FUNCTIONS[node.name];
        if (!fn) throw new Error(`Unknown function: '${node.name}'`);
        let arg = evalNode(node.arg);

        if (TRIG_FUNCTIONS.has(node.name) && angleUnit === 'deg') {
          arg = (arg * Math.PI) / 180;
        }

        const result = fn(arg);
        const power = evalNode(node.power);

        if (INVERSE_TRIG_FUNCTIONS.has(node.name) && angleUnit === 'deg') {
          return signedRealPow((result * 180) / Math.PI, power);
        }
        return signedRealPow(result, power);
      }
    }
  }

  return evalNode(ast);
}

/**
 * A compiled expression: `(a, b) => number`, where `a` stands in for whichever
 * of `x`/`t` the expression uses (they're always bound to the same value at
 * call sites — parametric curves evaluate a single parameter under both
 * names) and `b` stands in for `y`. Matches `evaluate`'s semantics exactly
 * (real odd roots of negatives, angle unit, NaN/Infinity on domain errors)
 * but is built once per (AST, angle unit) and reused across many (x, y)
 * samples without re-allocating a `variables` object or a fresh evalNode
 * closure per call — the two allocations `evaluate` incurs on every call.
 */
export type CompiledExpr = (a: number, b: number) => number;

interface CompileCacheEntry {
  rad?: CompiledExpr;
  deg?: CompiledExpr;
}

const compileCache = new WeakMap<ExpressionNode, CompileCacheEntry>();

function unknownVariable(name: string): CompiledExpr {
  return () => {
    throw new Error(`Unknown variable: '${name}'`);
  };
}

function unknownFunction(name: string): CompiledExpr {
  return () => {
    throw new Error(`Unknown function: '${name}'`);
  };
}

function compileNode(node: ExpressionNode, angleUnit: 'rad' | 'deg'): CompiledExpr {
  switch (node.type) {
    case 'NumberLiteral': {
      const v = node.value;
      return () => v;
    }

    case 'Variable': {
      const name = node.name;
      if (name === 'x' || name === 't') return (a) => a;
      if (name === 'y') return (_a, b) => b;
      if (Object.hasOwn(CONSTANTS, name)) {
        const v = CONSTANTS[name];
        return () => v;
      }
      return unknownVariable(name);
    }

    case 'BinaryOp': {
      const left = compileNode(node.left, angleUnit);
      const right = compileNode(node.right, angleUnit);
      switch (node.operator) {
        case '+':
          return (a, b) => left(a, b) + right(a, b);
        case '-':
          return (a, b) => left(a, b) - right(a, b);
        case '*':
          return (a, b) => left(a, b) * right(a, b);
        case '/':
          return (a, b) => left(a, b) / right(a, b);
        case '^':
          return (a, b) => signedRealPow(left(a, b), right(a, b));
        case '<':
          return (a, b) => (left(a, b) < right(a, b) ? 1 : 0);
        case '>':
          return (a, b) => (left(a, b) > right(a, b) ? 1 : 0);
        case '<=':
          return (a, b) => (left(a, b) <= right(a, b) ? 1 : 0);
        case '>=':
          return (a, b) => (left(a, b) >= right(a, b) ? 1 : 0);
        case '==':
          return (a, b) => (left(a, b) === right(a, b) ? 1 : 0);
        case '!=':
          return (a, b) => (left(a, b) !== right(a, b) ? 1 : 0);
        default: {
          const op = node.operator;
          return () => {
            throw new Error(`Unknown operator: '${op}'`);
          };
        }
      }
    }

    case 'UnaryOp': {
      const operand = compileNode(node.operand, angleUnit);
      if (node.operator === '-') return (a, b) => -operand(a, b);
      return operand;
    }

    case 'FunctionCall': {
      const fn = FUNCTIONS[node.name];
      if (!fn) return unknownFunction(node.name);
      const argFn = compileNode(node.arg, angleUnit);
      const isTrig = TRIG_FUNCTIONS.has(node.name);
      const isInvTrig = INVERSE_TRIG_FUNCTIONS.has(node.name);
      const toDeg = angleUnit === 'deg';
      return (a, b) => {
        let arg = argFn(a, b);
        if (isTrig && toDeg) arg = (arg * Math.PI) / 180;
        const result = fn(arg);
        if (isInvTrig && toDeg) return (result * 180) / Math.PI;
        return result;
      };
    }

    case 'FunctionCallMultiArg': {
      const mfn = MULTI_ARG_FUNCTIONS[node.name];
      if (mfn) {
        const argFns = node.args.map((arg) => compileNode(arg, angleUnit));
        const isAtan2Deg = node.name === 'atan2' && angleUnit === 'deg';
        return (a, b) => {
          const result = mfn(...argFns.map((f) => f(a, b)));
          return isAtan2Deg ? (result * 180) / Math.PI : result;
        };
      }
      const tfn = TWO_ARG_FUNCTIONS[node.name];
      if (tfn) {
        const f0 = compileNode(node.args[0], angleUnit);
        const f1 = compileNode(node.args[1], angleUnit);
        return (a, b) => tfn(f0(a, b), f1(a, b));
      }
      return unknownFunction(node.name);
    }

    case 'PoweredFunctionCall': {
      const fn = FUNCTIONS[node.name];
      if (!fn) return unknownFunction(node.name);
      const argFn = compileNode(node.arg, angleUnit);
      const powerFn = compileNode(node.power, angleUnit);
      const isTrig = TRIG_FUNCTIONS.has(node.name);
      const isInvTrig = INVERSE_TRIG_FUNCTIONS.has(node.name);
      const toDeg = angleUnit === 'deg';
      return (a, b) => {
        let arg = argFn(a, b);
        if (isTrig && toDeg) arg = (arg * Math.PI) / 180;
        const result = fn(arg);
        const power = powerFn(a, b);
        if (isInvTrig && toDeg) return signedRealPow((result * 180) / Math.PI, power);
        return signedRealPow(result, power);
      };
    }
  }
}

/**
 * Compiles `ast` into a reusable `(a, b) => number` closure tree, cached on
 * the AST node itself (and on `angleUnit`, since trig functions bake in the
 * deg/rad conversion at compile time). Call this once per expression edit —
 * not per sample — and reuse the returned function across an entire render.
 */
export function compileExpression(
  ast: ExpressionNode,
  angleUnit: 'rad' | 'deg' = 'rad',
): CompiledExpr {
  let entry = compileCache.get(ast);
  if (!entry) {
    entry = {};
    compileCache.set(ast, entry);
  }
  const cached = angleUnit === 'deg' ? entry.deg : entry.rad;
  if (cached) return cached;
  const fn = compileNode(ast, angleUnit);
  if (angleUnit === 'deg') entry.deg = fn;
  else entry.rad = fn;
  return fn;
}

export function evalExpression(
  rawOrAst: string | ExpressionNode,
  x: number,
  y?: number,
  angleUnit: 'rad' | 'deg' = 'rad',
): number {
  const ast = typeof rawOrAst === 'string' ? parse(rawOrAst) : rawOrAst;
  const vars: Record<string, number> = { x };
  if (y !== undefined) vars['y'] = y;
  return evaluate(ast, vars, angleUnit);
}

export function evalConstantExpression(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty expression');
  const ast = parse(trimmed);
  const result = evaluate(ast, {});
  if (!isFinite(result)) throw new Error('Expression is not a finite number');
  return result;
}
