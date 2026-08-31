export type ExpressionNode =
  | NumberLiteral
  | Variable
  | BinaryOp
  | UnaryOp
  | FunctionCall
  | FunctionCallMultiArg;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface Variable {
  type: 'Variable';
  name: string;
}

export interface BinaryOp {
  type: 'BinaryOp';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryOp {
  type: 'UnaryOp';
  operator: string;
  operand: ExpressionNode;
}

export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  arg: ExpressionNode;
}

export interface FunctionCallMultiArg {
  type: 'FunctionCallMultiArg';
  name: string;
  args: ExpressionNode[];
}

type TokenType =
  | 'number'
  | 'variable'
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const KNOWN_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'sqrt',
  'abs',
  'exp',
  'floor',
  'ceil',
  'round',
  'sign',
  'factorial',
  'logb',
  'root',
  'atan2',
  'gamma',
]);

const MULTI_ARG_FUNCTIONS = new Set(['min', 'max', 'mod', 'logb', 'root', 'atan2', 'npr', 'ncr']);

const MULTI_ARG_REQUIRED_ARGS = new Map([
  ['mod', 2], ['logb', 2], ['root', 2], ['atan2', 2],
  ['npr', 2], ['ncr', 2],
]);

const MAX_AST_NODES = 500;

class Lexer {
  private pos = 0;
  private tokens: Token[] = [];
  private input = '';

  tokenize(input: string): Token[] {
    this.pos = 0;
    this.tokens = [];
    this.input = input;
    while (this.pos < input.length) {
      this.skipWhitespace();
      if (this.pos >= input.length) break;

      const ch = input[this.pos];

      if ((ch >= '0' && ch <= '9') || ch === '.') {
        this.tokens.push(this.readNumber(input));
      } else if (ch === 'π') {
        this.tokens.push({ type: 'variable', value: 'π' });
        this.pos++;
      } else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
        this.tokens.push(this.readIdentifier(input));
      } else if (ch === '(') {
        this.tokens.push({ type: 'lparen', value: '(' });
        this.pos++;
      } else if (ch === ')') {
        this.tokens.push({ type: 'rparen', value: ')' });
        this.pos++;
      } else if (ch === ',') {
        this.tokens.push({ type: 'comma', value: ',' });
        this.pos++;
      } else if (ch === '<') {
        if (this.pos + 1 < input.length && input[this.pos + 1] === '=') {
          this.tokens.push({ type: 'operator', value: '<=' });
          this.pos += 2;
        } else {
          this.tokens.push({ type: 'operator', value: '<' });
          this.pos++;
        }
      } else if (ch === '>') {
        if (this.pos + 1 < input.length && input[this.pos + 1] === '=') {
          this.tokens.push({ type: 'operator', value: '>=' });
          this.pos += 2;
        } else {
          this.tokens.push({ type: 'operator', value: '>' });
          this.pos++;
        }
      } else if (ch === '=' ) {
        if (this.pos + 1 < input.length && input[this.pos + 1] === '=') {
          this.tokens.push({ type: 'operator', value: '==' });
          this.pos += 2;
        } else {
          this.tokens.push({ type: 'operator', value: '=' });
          this.pos++;
        }
      } else if (ch === '!' && this.pos + 1 < input.length && input[this.pos + 1] === '=') {
        this.tokens.push({ type: 'operator', value: '!=' });
        this.pos += 2;
      } else if ('+-*/^'.includes(ch)) {
        this.tokens.push({ type: 'operator', value: ch });
        this.pos++;
      } else {
        throw new Error(`Unexpected character: '${ch}' at position ${this.pos}`);
      }
    }
    this.insertImplicitMultiplication();
    this.tokens.push({ type: 'eof', value: '' });
    return this.tokens;
  }

  private insertImplicitMultiplication(): void {
    const result: Token[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      const tok = this.tokens[i];
      result.push(tok);
      if (i + 1 >= this.tokens.length) continue;
      const next = this.tokens[i + 1];

      const tokIsValue =
        tok.type === 'number' ||
        tok.type === 'rparen' ||
        (tok.type === 'variable' && !isKnownFunction(tok.value));
      const nextIsValue =
        next.type === 'variable' ||
        next.type === 'lparen';

      if (tokIsValue && nextIsValue) {
        if (tok.type === 'variable' && isKnownFunction(tok.value)) continue;
        result.push({ type: 'operator', value: '*' });
      }
    }
    this.tokens = result;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private readNumber(input: string): Token {
    let num = '';
    while (
      this.pos < input.length &&
      ((input[this.pos] >= '0' && input[this.pos] <= '9') || input[this.pos] === '.')
    ) {
      num += input[this.pos];
      this.pos++;
    }
    return { type: 'number', value: num };
  }

  private readIdentifier(input: string): Token {
    let id = '';
    while (
      this.pos < input.length &&
      ((input[this.pos] >= 'a' && input[this.pos] <= 'z') ||
        (input[this.pos] >= 'A' && input[this.pos] <= 'Z') ||
        (input[this.pos] >= '0' && input[this.pos] <= '9') ||
        input[this.pos] === '_')
    ) {
      id += input[this.pos];
      this.pos++;
    }
    const lower = id.toLowerCase();
    if (KNOWN_FUNCTIONS.has(lower)) {
      return { type: 'variable', value: lower };
    }
    return { type: 'variable', value: id };
  }
}

function isKnownFunction(name: string): boolean {
  return KNOWN_FUNCTIONS.has(name) || MULTI_ARG_FUNCTIONS.has(name);
}

class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  private nodeCount = 0;

  parse(input: string): ExpressionNode {
    const lexer = new Lexer();
    this.tokens = lexer.tokenize(input);
    this.pos = 0;
    this.nodeCount = 0;
    const expr = this.parseExpression();
    if (this.current().type !== 'eof') {
      throw new Error(`Unexpected token: '${this.current().value}'`);
    }
    return expr;
  }

  private countNode(): void {
    this.nodeCount++;
    if (this.nodeCount > MAX_AST_NODES) {
      throw new Error('Expression too complex');
    }
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'eof', value: '' };
  }

  private advance(): Token {
    const tok = this.current();
    this.pos++;
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.current();
    if (tok.type !== type) {
      throw new Error(`Expected ${type} but got ${tok.type} ('${tok.value}')`);
    }
    return this.advance();
  }

  private parseExpression(): ExpressionNode {
    return this.parseComparison();
  }

  private parseComparison(): ExpressionNode {
    let left = this.parseAddSub();
    while (
      this.current().type === 'operator' &&
      (this.current().value === '<' ||
        this.current().value === '>' ||
        this.current().value === '<=' ||
        this.current().value === '>=' ||
        this.current().value === '==' ||
        this.current().value === '!=')
    ) {
      const op = this.advance().value;
      const right = this.parseAddSub();
      this.countNode();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  private parseAddSub(): ExpressionNode {
    let left = this.parseMulDiv();
    while (
      this.current().type === 'operator' &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const op = this.advance().value;
      const right = this.parseMulDiv();
      this.countNode();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  private parseMulDiv(): ExpressionNode {
    let left = this.parsePower();
    while (
      this.current().type === 'operator' &&
      (this.current().value === '*' || this.current().value === '/')
    ) {
      const op = this.advance().value;
      const right = this.parsePower();
      this.countNode();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  private parsePower(): ExpressionNode {
    let base = this.parseUnary();
    if (this.current().type === 'operator' && this.current().value === '^') {
      this.advance();
      const exp = this.parsePower();
      this.countNode();
      base = { type: 'BinaryOp', operator: '^', left: base, right: exp };
    }
    return base;
  }

  private parseUnary(): ExpressionNode {
    if (
      this.current().type === 'operator' &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      if (operand.type === 'NumberLiteral' && op === '-') {
        return { type: 'NumberLiteral', value: -operand.value };
      }
      this.countNode();
      return { type: 'UnaryOp', operator: op, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const tok = this.current();

    if (tok.type === 'number') {
      this.advance();
      this.countNode();
      return { type: 'NumberLiteral', value: parseFloat(tok.value) };
    }

    if (tok.type === 'variable') {
      const name = tok.value;
      this.advance();

      if (name === 'e' || name === 'pi' || name === 'π') {
        this.countNode();
        return { type: 'Variable', name };
      }

      if (MULTI_ARG_FUNCTIONS.has(name)) {
        this.expect('lparen');
        const args: ExpressionNode[] = [this.parseExpression()];
        while (this.current().type === 'comma') {
          this.advance();
          args.push(this.parseExpression());
        }
        this.expect('rparen');
        const expected = MULTI_ARG_REQUIRED_ARGS.get(name);
        if (expected !== undefined && args.length !== expected) {
          throw new Error(`${name}() expects ${expected} arguments, got ${args.length}`);
        }
        this.countNode();
        return { type: 'FunctionCallMultiArg', name, args };
      }

      if (KNOWN_FUNCTIONS.has(name)) {
        this.expect('lparen');
        const arg = this.parseExpression();
        this.expect('rparen');
        this.countNode();
        return { type: 'FunctionCall', name, arg };
      }

      this.countNode();
      return { type: 'Variable', name };
    }

    if (tok.type === 'lparen') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('rparen');
      return expr;
    }

    throw new Error(`Unexpected token: '${tok.value}' at position ${this.pos}`);
  }
}

const parser = new Parser();
const astCache = new Map<string, ExpressionNode>();

export function parse(expression: string): ExpressionNode {
  const cached = astCache.get(expression);
  if (cached) return cached;
  if (astCache.size > 100) {
    const firstKey = astCache.keys().next().value;
    if (firstKey !== undefined) astCache.delete(firstKey);
  }
  const ast = parser.parse(expression);
  astCache.set(expression, ast);
  return ast;
}

export function clearAstCache(): void {
  astCache.clear();
}
