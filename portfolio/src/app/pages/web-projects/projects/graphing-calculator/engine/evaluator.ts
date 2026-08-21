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
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '^': return Math.pow(left, right);
        default: throw new Error(`Unknown operator: '${ast.operator}'`);
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
  }
}

export function evalExpression(raw: string, x: number): number {
  const ast = parse(raw);
  return evaluate(ast, { x });
}
