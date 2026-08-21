export type ExpressionNode =
  | NumberLiteral
  | Variable
  | BinaryOp
  | UnaryOp
  | FunctionCall;

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

type TokenType = 'number' | 'variable' | 'operator' | 'lparen' | 'rparen' | 'comma' | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const KNOWN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs', 'exp',
]);

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

      if (ch >= '0' && ch <= '9' || ch === '.') {
        this.tokens.push(this.readNumber(input));
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
      } else if ('+-*/^'.includes(ch)) {
        this.tokens.push({ type: 'operator', value: ch });
        this.pos++;
      } else {
        throw new Error(`Unexpected character: '${ch}' at position ${this.pos}`);
      }
    }
    this.tokens.push({ type: 'eof', value: '' });
    return this.tokens;
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
    while (this.pos < input.length && ((input[this.pos] >= '0' && input[this.pos] <= '9') || input[this.pos] === '.')) {
      num += input[this.pos];
      this.pos++;
    }
    return { type: 'number', value: num };
  }

  private readIdentifier(input: string): Token {
    let id = '';
    while (this.pos < input.length && ((input[this.pos] >= 'a' && input[this.pos] <= 'z') || (input[this.pos] >= 'A' && input[this.pos] <= 'Z') || (input[this.pos] >= '0' && input[this.pos] <= '9') || input[this.pos] === '_')) {
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

class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(input: string): ExpressionNode {
    const lexer = new Lexer();
    this.tokens = lexer.tokenize(input);
    this.pos = 0;
    const expr = this.parseExpression();
    if (this.current().type !== 'eof') {
      throw new Error(`Unexpected token: '${this.current().value}'`);
    }
    return expr;
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
    return this.parseAddSub();
  }

  private parseAddSub(): ExpressionNode {
    let left = this.parseMulDiv();
    while (this.current().type === 'operator' && (this.current().value === '+' || this.current().value === '-')) {
      const op = this.advance().value;
      const right = this.parseMulDiv();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  private parseMulDiv(): ExpressionNode {
    let left = this.parsePower();
    while (this.current().type === 'operator' && (this.current().value === '*' || this.current().value === '/')) {
      const op = this.advance().value;
      const right = this.parsePower();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  private parsePower(): ExpressionNode {
    let base = this.parseUnary();
    if (this.current().type === 'operator' && this.current().value === '^') {
      this.advance();
      const exp = this.parseUnary();
      base = { type: 'BinaryOp', operator: '^', left: base, right: exp };
    }
    return base;
  }

  private parseUnary(): ExpressionNode {
    if (this.current().type === 'operator' && (this.current().value === '+' || this.current().value === '-')) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      if (operand.type === 'NumberLiteral' && op === '-') {
        return { type: 'NumberLiteral', value: -operand.value };
      }
      return { type: 'UnaryOp', operator: op, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const tok = this.current();

    if (tok.type === 'number') {
      this.advance();
      return { type: 'NumberLiteral', value: parseFloat(tok.value) };
    }

    if (tok.type === 'variable') {
      const name = tok.value;
      this.advance();

      if (name === 'e' || name === 'pi') {
        return { type: 'Variable', name };
      }

      if (KNOWN_FUNCTIONS.has(name)) {
        this.expect('lparen');
        const arg = this.parseExpression();
        this.expect('rparen');
        return { type: 'FunctionCall', name, arg };
      }

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

export function parse(expression: string): ExpressionNode {
  return parser.parse(expression);
}
