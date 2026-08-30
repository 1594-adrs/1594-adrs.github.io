import type { ExpressionNode } from './parser';
import { parse } from './parser';

const CONSTANTS: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
  'π': Math.PI,
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
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
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

const MULTI_ARG_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  mod: (...args) => ((args[0] % args[1]) + args[1]) % args[1],
  logb: (base, x) => Math.log(x) / Math.log(base),
  root: (n, x) => Math.pow(x, 1 / n),
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
        if (node.name in variables) return variables[node.name];
        if (node.name in CONSTANTS) return CONSTANTS[node.name];
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
            return Math.pow(left, right);
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
    }
  }

  return evalNode(ast);
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
