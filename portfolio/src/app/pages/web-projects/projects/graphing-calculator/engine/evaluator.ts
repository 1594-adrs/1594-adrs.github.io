import { ExpressionNode, parse } from './parser';

const CONSTANTS: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
  π: Math.PI,
};

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
};

const MULTI_ARG_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  mod: (...args) => args[0] % args[1],
};

export function evaluate(ast: ExpressionNode, variables: Record<string, number>): number {
  switch (ast.type) {
    case 'NumberLiteral':
      return ast.value;

    case 'Variable':
      if (ast.name in variables) return variables[ast.name];
      if (ast.name in CONSTANTS) return CONSTANTS[ast.name];
      throw new Error(`Unknown variable: '${ast.name}'`);

    case 'BinaryOp': {
      const left = evaluate(ast.left, variables);
      const right = evaluate(ast.right, variables);
      switch (ast.operator) {
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
        default:
          throw new Error(`Unknown operator: '${ast.operator}'`);
      }
    }

    case 'UnaryOp': {
      const operand = evaluate(ast.operand, variables);
      return ast.operator === '-' ? -operand : operand;
    }

    case 'FunctionCall': {
      const fn = FUNCTIONS[ast.name];
      if (!fn) throw new Error(`Unknown function: '${ast.name}'`);
      return fn(evaluate(ast.arg, variables));
    }

    case 'FunctionCallMultiArg': {
      const fn = MULTI_ARG_FUNCTIONS[ast.name];
      if (!fn) throw new Error(`Unknown function: '${ast.name}'`);
      return fn(...ast.args.map((a) => evaluate(a, variables)));
    }
  }
}

export function evalExpression(raw: string, x: number, y?: number): number;
export function evalExpression(ast: ExpressionNode, x: number, y?: number): number;
export function evalExpression(rawOrAst: string | ExpressionNode, x: number, y?: number): number {
  const ast = typeof rawOrAst === 'string' ? parse(rawOrAst) : rawOrAst;
  const vars: Record<string, number> = { x };
  if (y !== undefined) vars['y'] = y;
  return evaluate(ast, vars);
}

export function evalConstantExpression(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty expression');
  const ast = parse(trimmed);
  const result = evaluate(ast, {});
  if (!isFinite(result)) throw new Error('Expression is not a finite number');
  return result;
}
