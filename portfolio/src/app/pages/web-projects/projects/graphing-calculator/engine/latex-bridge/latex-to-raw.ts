/**
 * LaTeX (as emitted by MathLive) -> the calculator's plain-text grammar.
 *
 * Tokenizer + recursive descent that builds the output string directly while
 * tracking a precedence level per sub-expression, so every implicit
 * multiplication is made explicit (`2x` -> `2*x`) and parentheses are added
 * only where the parser's precedence would otherwise change the meaning.
 * Never throws: problems are collected in `issues`.
 */

export interface LatexToRawResult {
  /** Plain-text expression in the parser's grammar (e.g. `sin(x)^2+sqrt(x)`). */
  raw: string;
  /** Human-readable problems: unsupported commands, placeholders left empty, etc. */
  issues: string[];
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** d = digit or '.', l = letter, c = command, s = symbol, t = text-like command + braced body. */
interface Tok {
  k: 'd' | 'l' | 'c' | 's' | 't' | 'eof';
  v: string;
  /** Command name for `c` and `t` tokens (without the backslash). */
  n?: string;
}

const EOF: Tok = { k: 'eof', v: '' };

const SKIPPED_COMMANDS = new Set([
  ',',
  ' ',
  ';',
  ':',
  '!',
  'quad',
  'qquad',
  'displaystyle',
  'textstyle',
  'scriptstyle',
  'limits',
  'nolimits',
  'hfill',
]);

const TEXT_COMMANDS = new Set([
  'mathrm',
  'operatorname',
  'text',
  'textrm',
  'mathit',
  'mathbf',
  'mathsf',
  'mathtt',
  'textit',
  'textbf',
  'mathnormal',
]);

const UNICODE_COMMANDS: Record<string, string> = {
  '×': 'times',
  '÷': 'div',
  '·': 'cdot',
  '⋅': 'cdot',
  π: 'pi',
  θ: 'theta',
  '≤': 'le',
  '≥': 'ge',
  '≠': 'ne',
  '√': 'sqrt',
};

function readBalanced(src: string, start: number): { body: string; end: number } {
  // src[start] === '{'
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { body: src.slice(start + 1, i), end: i + 1 };
    }
    i++;
  }
  return { body: src.slice(start + 1), end: src.length };
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch) || ch === '~') {
      i++;
    } else if (ch === '\\') {
      i++;
      let name: string;
      const word = /^[A-Za-z]+/.exec(src.slice(i));
      if (word) {
        name = word[0];
        i += name.length;
      } else {
        name = src[i] ?? '';
        i += name ? 1 : 0;
      }
      if (name === '') continue;
      if (SKIPPED_COMMANDS.has(name)) continue;
      if (TEXT_COMMANDS.has(name)) {
        let j = i;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === '{') {
          const { body, end } = readBalanced(src, j);
          toks.push({ k: 't', n: name, v: body });
          i = end;
          continue;
        }
      }
      if (name === '{') toks.push({ k: 'c', n: 'lbrace', v: '\\{' });
      else if (name === '}') toks.push({ k: 'c', n: 'rbrace', v: '\\}' });
      else if (name === '|') toks.push({ k: 'c', n: 'Vert', v: '\\|' });
      else toks.push({ k: 'c', n: name, v: '\\' + name });
    } else if ((ch >= '0' && ch <= '9') || ch === '.') {
      toks.push({ k: 'd', v: ch });
      i++;
    } else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      toks.push({ k: 'l', v: ch });
      i++;
    } else if (
      ch === '{' &&
      src.startsWith('{,}', i) &&
      toks.length > 0 &&
      toks[toks.length - 1].k === 'd' &&
      /[0-9]/.test(src[i + 3] ?? '')
    ) {
      // MathLive's decimal-comma form `1{,}5`.
      toks.push({ k: 'd', v: '.' });
      i += 3;
    } else if ("+-*/=<>,!|()[]{}^_'&".includes(ch)) {
      toks.push({ k: 's', v: ch });
      i++;
    } else if (ch === '−') {
      toks.push({ k: 's', v: '-' });
      i++;
    } else if (UNICODE_COMMANDS[ch]) {
      toks.push({ k: 'c', n: UNICODE_COMMANDS[ch], v: ch });
      i++;
    } else if (/\p{L}/u.test(ch)) {
      toks.push({ k: 'l', v: ch });
      i++;
    } else {
      toks.push({ k: 's', v: ch });
      i++;
    }
  }
  return toks;
}

// ---------------------------------------------------------------------------
// Function tables
// ---------------------------------------------------------------------------

/** LaTeX command (no backslash) -> parser function name. */
const COMMAND_FUNCTIONS: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  sec: 'sec',
  csc: 'csc',
  cot: 'cot',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  ln: 'ln',
  log: 'log',
  exp: 'exp',
};

/** Names accepted inside `\operatorname{..}` / `\mathrm{..}` (compared lowercase). */
const NAMED_FUNCTIONS = new Set([
  'abs',
  'sign',
  'min',
  'max',
  'mod',
  'round',
  'floor',
  'ceil',
  'gamma',
  'atan2',
  'root',
  'factorial',
  'ncr',
  'npr',
  'logb',
  'sqrt',
  'asin',
  'acos',
  'atan',
]);

const MULTI_ARG = new Set(['min', 'max', 'mod', 'logb', 'root', 'atan2', 'npr', 'ncr']);

/** `\sin^{-1}` is read as the inverse function (textbook convention). */
const INVERSE_OF_POWER_MINUS_ONE: Record<string, string> = {
  sin: 'asin',
  cos: 'acos',
  tan: 'atan',
};

function resolveFunctionName(name: string): string | null {
  const lower = name.toLowerCase();
  if (Object.hasOwn(COMMAND_FUNCTIONS, lower)) return COMMAND_FUNCTIONS[lower];
  if (NAMED_FUNCTIONS.has(lower)) return lower;
  return null;
}

function decodeText(text: string): string {
  return text.replace(/\\(backslash|\^\{\}|~\{\}|[_{}%&#$ ])/g, (_m, c: string) => {
    if (c === 'backslash') return '\\';
    if (c === '^{}') return '^';
    if (c === '~{}') return '~';
    return c;
  });
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const REL = 0;
const ADD = 1;
const MUL = 2;
const UNARY = 3;
const POW = 4;
const ATOM = 5;

const MAX_DEPTH = 150;

interface N {
  s: string;
  /** Precedence of the top-level operator of `s`. */
  p: number;
  /** `s` is wrapped in its own parentheses. */
  paren?: boolean;
  /** Parenthesised group holding several comma-separated items, e.g. `(cos t, sin t)`. */
  tuple?: boolean;
  /** Free text kept verbatim (never joined with `*`). */
  opaque?: boolean;
}

const empty = (): N => ({ s: '', p: ATOM });
const atom = (s: string): N => ({ s, p: ATOM });
const wrap = (n: N): string => (n.paren ? n.s : `(${n.s})`);
const neg = (n: N): N => ({ s: '-' + n.s, p: UNARY });

const NON_FACTOR_COMMANDS = new Set([
  'right',
  'rfloor',
  'rceil',
  'rvert',
  'rbrace',
  'rangle',
  'cdot',
  'times',
  'ast',
  'div',
  'le',
  'leq',
  'ge',
  'geq',
  'ne',
  'neq',
  'lt',
  'gt',
]);

type GroupKind = 'paren' | 'abs' | 'floor' | 'ceil';

class LatexParser {
  private pos = 0;
  private depth = 0;
  private absDepth = 0;

  constructor(
    private readonly toks: Tok[],
    private readonly issues: Set<string>,
  ) {}

  private peek(o = 0): Tok {
    return this.toks[this.pos + o] ?? EOF;
  }

  private next(): Tok {
    const t = this.peek();
    if (this.pos < this.toks.length) this.pos++;
    return t;
  }

  private issue(msg: string): void {
    this.issues.add(msg);
  }

  private isSym(t: Tok, v: string): boolean {
    return t.k === 's' && t.v === v;
  }

  // -- top level -----------------------------------------------------------

  parseTop(): string {
    let out = '';
    let first = true;
    for (;;) {
      const n = this.expr();
      if (first && n.tuple && this.peek().k === 'eof') return n.s.slice(1, -1);
      first = false;
      out += n.s;
      const op = this.tryRelation();
      if (op !== null) {
        out += op;
        continue;
      }
      if (this.isSym(this.peek(), ',')) {
        this.next();
        out += ',';
        continue;
      }
      if (this.peek().k === 'eof') break;
      out += this.stray(this.next());
    }
    return out;
  }

  private stray(t: Tok): string {
    if (t.k === 's' && (t.v === ')' || t.v === ']')) {
      this.issue('Unbalanced parentheses');
      return t.v;
    }
    if (t.k === 's' && t.v === '}') {
      this.issue('Unbalanced braces');
      return '';
    }
    if (t.k === 'c' && /^r(ight|floor|ceil|vert|brace)$/.test(t.n ?? '')) {
      this.issue('Unbalanced parentheses');
      return '';
    }
    this.issue(`Unsupported: ${t.k === 'c' ? t.v : t.v}`);
    return '';
  }

  private tryRelation(): string | null {
    const t = this.peek();
    if (t.k === 's') {
      if (t.v === '=') {
        this.next();
        if (this.isSym(this.peek(), '=')) this.next();
        return '=';
      }
      if (t.v === '<' || t.v === '>') {
        this.next();
        if (this.isSym(this.peek(), '=')) {
          this.next();
          return t.v + '=';
        }
        return t.v;
      }
      if (t.v === '!' && this.isSym(this.peek(1), '=')) {
        this.next();
        this.next();
        return '!=';
      }
      return null;
    }
    if (t.k === 'c') {
      const map: Record<string, string> = {
        le: '<=',
        leq: '<=',
        ge: '>=',
        geq: '>=',
        ne: '!=',
        neq: '!=',
        lt: '<',
        gt: '>',
      };
      if (t.n && Object.hasOwn(map, t.n)) {
        this.next();
        return map[t.n];
      }
    }
    return null;
  }

  // -- expressions ---------------------------------------------------------

  /** Comma-separated items, each possibly containing relations (used inside groups). */
  private list(): N[] {
    const items: N[] = [];
    for (;;) {
      items.push(this.relationItem());
      if (this.isSym(this.peek(), ',')) {
        this.next();
        continue;
      }
      return items;
    }
  }

  private relationItem(): N {
    const n = this.expr();
    let s = n.s;
    let any = false;
    for (let op = this.tryRelation(); op !== null; op = this.tryRelation()) {
      s += op + this.expr().s;
      any = true;
    }
    return any ? { s, p: REL } : n;
  }

  /** Consumes `+`/`-` tokens, returns the net sign. */
  private signs(): '' | '-' {
    let negative = false;
    for (;;) {
      const t = this.peek();
      if (this.isSym(t, '-')) negative = !negative;
      else if (!this.isSym(t, '+')) break;
      this.next();
    }
    return negative ? '-' : '';
  }

  private expr(): N {
    const sign = this.signs();
    const first = this.term();
    let acc: N = sign === '-' ? neg(first) : first;
    for (;;) {
      const t = this.peek();
      if (!(this.isSym(t, '+') || this.isSym(t, '-'))) break;
      this.next();
      let op = t.v;
      if (this.signs() === '-') op = op === '-' ? '+' : '-';
      const rhs = this.term();
      acc = { s: acc.s + op + rhs.s, p: ADD };
    }
    return acc;
  }

  private term(): N {
    let acc = this.factor();
    for (;;) {
      const t = this.peek();
      let op: string | null = null;
      if (this.isSym(t, '*') || (t.k === 'c' && ['cdot', 'times', 'ast'].includes(t.n ?? ''))) {
        op = '*';
      } else if (this.isSym(t, '/') || (t.k === 'c' && t.n === 'div')) {
        op = '/';
      }
      if (op !== null) {
        this.next();
        const sign = this.signs();
        let f = this.factor();
        if (sign === '-') f = { s: `(-${f.s})`, p: ATOM, paren: true };
        acc = { s: acc.s + op + f.s, p: MUL };
      } else if (this.isFactorStart(t)) {
        acc = this.implicit(acc, this.factor());
      } else {
        break;
      }
    }
    return acc;
  }

  private implicit(a: N, b: N): N {
    if (b.s === '') return a;
    if (a.s === '') return b;
    const sep = a.opaque || b.opaque ? '' : '*';
    return { s: a.s + sep + b.s, p: MUL, opaque: b.opaque };
  }

  private isFactorStart(t: Tok): boolean {
    switch (t.k) {
      case 'd':
      case 'l':
      case 't':
        return true;
      case 's':
        if (t.v === '|') return this.absDepth === 0;
        return t.v === '(' || t.v === '[' || t.v === '{';
      case 'c':
        if (t.n === 'vert' || t.n === 'lvert') return this.absDepth === 0;
        return !NON_FACTOR_COMMANDS.has(t.n ?? '');
      default:
        return false;
    }
  }

  private isFunctionStart(t: Tok): boolean {
    if (t.k === 'c') return Object.hasOwn(COMMAND_FUNCTIONS, t.n ?? '');
    if (t.k === 't') return resolveFunctionName(decodeText(t.v).trim()) !== null;
    return false;
  }

  private factor(): N {
    return this.postfix(this.primary());
  }

  /** Operand of a function written without parentheses: `\sin 2x` -> product `2*x`. */
  private argTerm(): N {
    const sign = this.signs();
    let acc = this.factor();
    while (this.isFactorStart(this.peek()) && !this.isFunctionStart(this.peek())) {
      acc = this.implicit(acc, this.factor());
    }
    return sign === '-' ? neg(acc) : acc;
  }

  private pow(base: N, exp: N): N {
    if (base.s === '' || exp.s === '') return { s: base.s, p: base.p, paren: base.paren };
    const b = base.p >= ATOM ? base.s : `(${base.s})`;
    const e = exp.p >= ATOM ? exp.s : `(${exp.s})`;
    return { s: `${b}^${e}`, p: POW };
  }

  private postfix(base: N): N {
    let n = base;
    for (;;) {
      const t = this.peek();
      if (this.isSym(t, '!') && !this.isSym(this.peek(1), '=')) {
        this.next();
        if (n.s !== '') n = atom(`factorial(${n.s})`);
      } else if (this.isSym(t, '^')) {
        this.next();
        n = this.pow(n, this.scriptArg());
      } else if (this.isSym(t, '_')) {
        this.next();
        this.scriptArg();
        this.issue('Unsupported: subscript');
      } else if (this.isSym(t, "'")) {
        this.next();
        this.issue("Unsupported: '");
      } else {
        return n;
      }
    }
  }

  // -- primaries -----------------------------------------------------------

  /** Argument of `^`, `_`, `\frac`, `\sqrt`...: a braced group or a single token. */
  private scriptArg(): N {
    const t = this.peek();
    if (this.isSym(t, '{')) {
      this.next();
      return this.braced();
    }
    if (t.k === 'd') {
      this.next();
      return atom(t.v);
    }
    if (t.k === 'l') {
      this.next();
      return atom(t.v);
    }
    if (t.k === 'c' || t.k === 't') {
      const n = this.primary();
      if (n.s === '') this.issue('Incomplete expression');
      return n;
    }
    this.issue('Incomplete expression');
    return empty();
  }

  /** After the opening `{` has been consumed. */
  private braced(): N {
    if (++this.depth > MAX_DEPTH) throw new Error('too deep');
    const items = this.list();
    while (!this.isSym(this.peek(), '}') && this.peek().k !== 'eof') {
      this.stray(this.next());
    }
    if (this.isSym(this.peek(), '}')) this.next();
    else this.issue('Unbalanced braces');
    this.depth--;
    if (items.length === 1) return items[0];
    return { s: items.map((i) => i.s).join(','), p: REL };
  }

  private primary(): N {
    const t = this.peek();
    if (!this.isFactorStart(t)) return empty();
    if (++this.depth > MAX_DEPTH) throw new Error('too deep');
    try {
      return this.primaryOf(this.next());
    } finally {
      this.depth--;
    }
  }

  private primaryOf(t: Tok): N {
    switch (t.k) {
      case 'd':
        return this.number(t);
      case 'l':
        return atom(t.v);
      case 't':
        return this.textToken(t);
      case 's':
        if (t.v === '(' || t.v === '[') return this.group('paren', false);
        if (t.v === '{') {
          const n = this.braced();
          return n.s === '' || n.p >= ATOM ? n : { s: `(${n.s})`, p: ATOM, paren: true };
        }
        return this.group('abs', true); // bare '|'
      case 'c':
        return this.command(t);
      default:
        return empty();
    }
  }

  private number(first: Tok): N {
    let s = first.v;
    while (this.peek().k === 'd') s += this.next().v;
    if ((s.match(/\./g) ?? []).length > 1) this.issue(`Invalid number: ${s}`);
    // Uppercase-E scientific notation (the parser only accepts uppercase `E`).
    const e = this.peek();
    const isE = (e.k === 'l' && e.v === 'E') || (e.k === 't' && decodeText(e.v).trim() === 'E');
    if (isE) {
      let j = 1;
      let sign = '';
      const sg = this.peek(j);
      if (this.isSym(sg, '+') || this.isSym(sg, '-')) {
        sign = sg.v;
        j++;
      }
      if (this.peek(j).k === 'd' && this.peek(j).v !== '.') {
        this.pos += j;
        let digits = '';
        while (this.peek().k === 'd' && this.peek().v !== '.') digits += this.next().v;
        s += 'E' + sign + digits;
      }
    }
    return atom(s);
  }

  private textToken(t: Tok): N {
    const text = decodeText(t.v);
    const name = text.trim();
    const fn = resolveFunctionName(name);
    if (fn !== null) return this.func(fn);
    if (name === 'theta') return atom('t');
    if (name === 'e' || name === 'pi') return atom(name);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      if (t.n === 'operatorname') this.issue(`Unsupported: \\operatorname{${name}}`);
      return atom(name);
    }
    if (name === '') return empty();
    return { s: text, p: ATOM, opaque: true };
  }

  private command(t: Tok): N {
    const name = t.n ?? '';
    if (Object.hasOwn(COMMAND_FUNCTIONS, name)) return this.func(COMMAND_FUNCTIONS[name]);
    switch (name) {
      case 'pi':
        return atom('pi');
      case 'theta':
        // The evaluator's polar/parametric variable is `t`; it has no `theta`.
        return atom('t');
      case 'exponentialE':
        return atom('e');
      case 'frac':
      case 'dfrac':
      case 'tfrac': {
        const a = this.scriptArg();
        const b = this.scriptArg();
        const inner = `${wrap(a)}/${wrap(b)}`;
        return { s: `(${inner})`, p: ATOM, paren: true };
      }
      case 'binom':
      case 'dbinom':
      case 'tbinom': {
        const a = this.scriptArg();
        const b = this.scriptArg();
        return atom(`ncr(${a.s},${b.s})`);
      }
      case 'sqrt': {
        if (this.isSym(this.peek(), '[')) {
          this.next();
          const n = this.relationItem();
          while (!this.isSym(this.peek(), ']') && this.peek().k !== 'eof') this.stray(this.next());
          this.next();
          const a = this.scriptArg();
          return atom(`root(${n.s},${a.s})`);
        }
        return atom(`sqrt(${this.scriptArg().s})`);
      }
      case 'left':
        return this.left();
      case 'lfloor':
        return this.group('floor', false);
      case 'lceil':
        return this.group('ceil', false);
      case 'lvert':
      case 'vert':
        return this.group('abs', true);
      case 'lbrace':
        return this.group('paren', false);
      case 'placeholder': {
        if (this.isSym(this.peek(), '[')) {
          while (!this.isSym(this.peek(), ']') && this.peek().k !== 'eof') this.next();
          this.next();
        }
        if (this.isSym(this.peek(), '{')) {
          this.next();
          this.skipBraced();
        }
        this.issue('Incomplete expression');
        return empty();
      }
      default:
        this.issue(`Unsupported: ${t.v}`);
        return empty();
    }
  }

  /** After an opening `{` has been consumed: skip to the matching `}`. */
  private skipBraced(): void {
    let depth = 1;
    while (depth > 0 && this.peek().k !== 'eof') {
      const t = this.next();
      if (this.isSym(t, '{')) depth++;
      else if (this.isSym(t, '}')) depth--;
    }
  }

  private left(): N {
    const d = this.next();
    if (this.isSym(d, '|') || (d.k === 'c' && (d.n === 'vert' || d.n === 'lvert'))) {
      return this.group('abs', false);
    }
    if (d.k === 'c' && d.n === 'lfloor') return this.group('floor', false);
    if (d.k === 'c' && d.n === 'lceil') return this.group('ceil', false);
    if (d.k === 'c' && d.n === 'langle') this.issue('Unsupported: \\langle');
    return this.group('paren', false);
  }

  /** Parses items up to the closer; the opener was already consumed. */
  private group(kind: GroupKind, bareBar: boolean): N {
    if (bareBar) this.absDepth++;
    const items = this.list();
    if (bareBar) this.absDepth--;
    this.close(kind);
    const inner = items.map((i) => i.s).join(',');
    switch (kind) {
      case 'abs':
        return atom(`abs(${inner})`);
      case 'floor':
        return atom(`floor(${inner})`);
      case 'ceil':
        return atom(`ceil(${inner})`);
      default:
        return { s: `(${inner})`, p: ATOM, paren: true, tuple: items.length > 1 };
    }
  }

  private close(kind: GroupKind): void {
    const t = this.peek();
    const ok =
      (t.k === 's' &&
        ((kind === 'paren' && (t.v === ')' || t.v === ']')) || (kind === 'abs' && t.v === '|'))) ||
      (t.k === 'c' &&
        ((kind === 'floor' && t.n === 'rfloor') ||
          (kind === 'ceil' && t.n === 'rceil') ||
          (kind === 'abs' && (t.n === 'rvert' || t.n === 'vert')) ||
          (kind === 'paren' && t.n === 'rbrace')));
    if (ok) {
      this.next();
    } else if (t.k === 'c' && t.n === 'right') {
      this.next();
      this.next(); // the delimiter
    } else {
      this.issue('Unbalanced parentheses');
    }
  }

  // -- functions -----------------------------------------------------------

  private func(name: string): N {
    let power: N | null = null;
    let sub: N | null = null;
    for (;;) {
      const t = this.peek();
      if (this.isSym(t, '^')) {
        this.next();
        power = this.scriptArg();
      } else if (this.isSym(t, '_')) {
        this.next();
        sub = this.scriptArg();
      } else {
        break;
      }
    }

    let args: string[];
    const t = this.peek();
    const t1 = this.peek(1);
    if (this.isSym(t, '(')) {
      this.next();
      args = this.list().map((i) => i.s);
      this.close('paren');
    } else if (t.k === 'c' && t.n === 'left' && (this.isSym(t1, '(') || this.isSym(t1, '['))) {
      this.next();
      this.next();
      args = this.list().map((i) => i.s);
      this.close('paren');
    } else if (this.isSym(t, '{')) {
      this.next();
      args = [this.braced().s];
    } else if (MULTI_ARG.has(name)) {
      this.issue('Incomplete expression');
      args = [];
    } else {
      const a = this.argTerm();
      if (a.s === '') this.issue('Incomplete expression');
      args = [a.s];
    }

    let fname = name;
    if (sub) {
      if (name === 'log') {
        fname = 'logb';
        args = [sub.s, ...args];
      } else {
        this.issue('Unsupported: subscript');
      }
    }
    if (power && power.s === '-1' && Object.hasOwn(INVERSE_OF_POWER_MINUS_ONE, fname)) {
      return atom(`${INVERSE_OF_POWER_MINUS_ONE[fname]}(${args.join(',')})`);
    }
    const call = atom(`${fname}(${args.join(',')})`);
    return power ? this.pow(call, power) : call;
  }
}

/** LaTeX (MathLive output) -> parser syntax. Never throws. */
export function latexToRaw(latex: string): LatexToRawResult {
  const issues = new Set<string>();
  if (typeof latex !== 'string') return { raw: '', issues: [] };
  try {
    const raw = new LatexParser(tokenize(latex), issues).parseTop();
    return { raw, issues: [...issues] };
  } catch {
    issues.add('Expression too complex');
    return { raw: '', issues: [...issues] };
  }
}
