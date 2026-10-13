/**
 * The calculator's plain-text grammar -> LaTeX for `mathfield.setValue`.
 *
 * The raw string is split at top-level separators (`<= >= != == < > = ,`), each
 * part is parsed with the project parser and printed from the AST with
 * precedence-aware parentheses. Parts that do not parse (incomplete typing such
 * as `sin(`) are kept as escaped text so nothing is lost. Never throws.
 */
import { parse } from '../parser';
import type { ExpressionNode } from '../parser';

const REL = 0;
const ADD = 1;
const MUL = 2;
const UNARY = 3;
const POW = 4;
const ATOM = 5;

interface L {
  s: string;
  /** Precedence of the top-level operator of `s`. */
  p: number;
  /** `\frac{..}{..}` (needs a `\cdot` after a number and parentheses as a power base). */
  frac?: boolean;
}

const left = '\\left(';
const right = '\\right)';
const paren = (n: L): string => `${left}${n.s}${right}`;

/** Functions printed as `\name\left(x\right)`; the value maps parser name -> LaTeX command. */
const COMMAND_FUNCTIONS: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  sec: 'sec',
  csc: 'csc',
  cot: 'cot',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  asin: 'arcsin',
  acos: 'arccos',
  atan: 'arctan',
  ln: 'ln',
  log: 'log',
  exp: 'exp',
};

/** Functions whose power is written before the argument: `\sin^{2}\left(x\right)`. */
const PREFIX_POWER = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh']);

const TEXT_ESCAPES: Record<string, string> = {
  '\\': '\\backslash ',
  '{': '\\{',
  '}': '\\}',
  _: '\\_',
  '^': '\\^{}',
  '%': '\\%',
  '&': '\\&',
  '#': '\\#',
  $: '\\$',
  '~': '\\~{}',
  ' ': '\\ ',
};

/** Escapes `text` so it renders verbatim inside `\mathrm{..}`. */
function escapeText(text: string): string {
  let out = '';
  for (const ch of text) out += TEXT_ESCAPES[ch] ?? ch;
  return out;
}

function textFallback(text: string): string {
  return text === '' ? '' : `\\mathrm{${escapeText(text)}}`;
}

function variable(name: string): string {
  if (name === 'pi' || name === 'π') return '\\pi';
  if (name === 'theta') return '\\theta';
  if (/^[A-Za-z]$/.test(name)) return name;
  return textFallback(name);
}

function numberLatex(value: number): L {
  if (!Number.isFinite(value)) return { s: value < 0 ? '-\\infty' : '\\infty', p: UNARY };
  let s = String(Math.abs(value));
  let p = ATOM;
  if (s.includes('e')) {
    const [mantissa, exponent] = s.split('e');
    const e = Number(exponent);
    s = mantissa === '1' ? `10^{${e}}` : `${mantissa}\\cdot10^{${e}}`;
    p = mantissa === '1' ? POW : MUL;
  }
  return value < 0 ? { s: '-' + s, p: UNARY } : { s, p };
}

/** Product of two printed factors: juxtapose unless that would be ambiguous. */
function product(l: L, r: L): string {
  const needsDot = /^[0-9.]/.test(r.s) || (r.frac === true && /[0-9]$/.test(l.s));
  if (needsDot) return `${l.s}\\cdot${r.s}`;
  if (/\\[A-Za-z]+$/.test(l.s) && /^[A-Za-z]/.test(r.s)) return `${l.s} ${r.s}`;
  return l.s + r.s;
}

const COMPARISON: Record<string, string> = {
  '<': '<',
  '>': '>',
  '<=': '\\le ',
  '>=': '\\ge ',
  '!=': '\\ne ',
  '==': '=',
  '=': '=',
};

function emit(n: ExpressionNode): L {
  switch (n.type) {
    case 'NumberLiteral':
      return numberLatex(n.value);
    case 'Variable':
      return { s: variable(n.name), p: ATOM };
    case 'UnaryOp': {
      const o = emit(n.operand);
      if (n.operator !== '-') return o;
      return { s: '-' + (o.p <= UNARY ? paren(o) : o.s), p: UNARY };
    }
    case 'BinaryOp':
      // `(sin(x))^2` is the same value as `sin^2(x)`: print both the textbook way.
      if (n.operator === '^' && n.left.type === 'FunctionCall' && PREFIX_POWER.has(n.left.name)) {
        return powered(n.left.name, n.left.arg, n.right);
      }
      return binary(n.operator, emit(n.left), emit(n.right));
    case 'FunctionCall':
      return call(n.name, [emit(n.arg)]);
    case 'FunctionCallMultiArg':
      return call(n.name, n.args.map(emit));
    case 'PoweredFunctionCall':
      return powered(n.name, n.arg, n.power);
  }
}

function binary(op: string, l: L, r: L): L {
  switch (op) {
    case '+': {
      const ls = l.p < ADD ? paren(l) : l.s;
      // x + (-y) reads better (and is equal) as x - y.
      if (r.p === UNARY && r.s.startsWith('-')) return { s: ls + r.s, p: ADD };
      return { s: `${ls}+${r.p <= ADD ? paren(r) : r.s}`, p: ADD };
    }
    case '-':
      return { s: `${l.p < ADD ? paren(l) : l.s}-${r.p <= UNARY ? paren(r) : r.s}`, p: ADD };
    case '*': {
      const lw: L = l.p < MUL ? { s: paren(l), p: ATOM } : l;
      const rw: L = r.p <= UNARY ? { s: paren(r), p: ATOM } : r;
      return { s: product(lw, rw), p: MUL };
    }
    case '/':
      return { s: `\\frac{${l.s}}{${r.s}}`, p: ATOM, frac: true };
    case '^': {
      const base = l.p >= ATOM && !l.frac ? l.s : paren(l);
      return { s: `${base}^{${r.s}}`, p: POW };
    }
    default: {
      const sym = COMPARISON[op] ?? op;
      return { s: `${l.p <= REL ? paren(l) : l.s}${sym}${r.p <= REL ? paren(r) : r.s}`, p: REL };
    }
  }
}

function call(name: string, a: L[]): L {
  const first = a[0] ?? { s: '', p: ATOM };
  const second = a[1] ?? { s: '', p: ATOM };
  if (Object.hasOwn(COMMAND_FUNCTIONS, name)) {
    return { s: `\\${COMMAND_FUNCTIONS[name]}${left}${first.s}${right}`, p: ATOM };
  }
  switch (name) {
    case 'sqrt':
      return { s: `\\sqrt{${first.s}}`, p: ATOM };
    case 'abs':
      return { s: `\\left|${first.s}\\right|`, p: ATOM };
    case 'floor':
      return { s: `\\left\\lfloor ${first.s}\\right\\rfloor`, p: ATOM };
    case 'ceil':
      return { s: `\\left\\lceil ${first.s}\\right\\rceil`, p: ATOM };
    case 'root':
      return { s: `\\sqrt[${first.s}]{${second.s}}`, p: ATOM };
    case 'logb':
      return { s: `\\log_{${first.s}}${left}${second.s}${right}`, p: ATOM };
    case 'ncr':
      return { s: `\\binom{${first.s}}{${second.s}}`, p: ATOM };
    case 'factorial': {
      const simple = /^([0-9]+|[A-Za-z]|\\pi|\\theta)$/.test(first.s);
      return { s: simple ? `${first.s}!` : `${paren(first)}!`, p: ATOM };
    }
    default:
      return {
        s: `\\operatorname{${escapeText(name)}}${left}${a.map((x) => x.s).join(',')}${right}`,
        p: ATOM,
      };
  }
}

function powered(name: string, argNode: ExpressionNode, powerNode: ExpressionNode): L {
  const arg = emit(argNode);
  const power = emit(powerNode);
  if (PREFIX_POWER.has(name)) {
    const cmd = COMMAND_FUNCTIONS[name];
    // `\sin^{-1}` would be read back as arcsin, so the reciprocal is spelled with parentheses.
    if (power.s === '-1') {
      return { s: `${left}\\${cmd}${left}${arg.s}${right}${right}^{-1}`, p: POW };
    }
    return { s: `\\${cmd}^{${power.s}}${left}${arg.s}${right}`, p: POW };
  }
  return binary('^', call(name, [arg]), power);
}

// ---------------------------------------------------------------------------

interface Split {
  parts: string[];
  seps: string[];
}

/** Splits at depth-0 comparison operators and commas (mirrors the component's splitting). */
function splitTopLevel(raw: string): Split {
  const parts: string[] = [];
  const seps: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const two = raw.slice(i, i + 2);
      let sep = '';
      if (two === '<=' || two === '>=' || two === '!=' || two === '==') sep = two;
      else if (ch === '<' || ch === '>' || ch === '=' || ch === ',') sep = ch;
      if (sep) {
        parts.push(raw.slice(start, i));
        seps.push(sep);
        i += sep.length - 1;
        start = i + 1;
      }
    }
  }
  parts.push(raw.slice(start));
  return { parts, seps };
}

function partToLatex(part: string): string {
  const text = part.trim();
  if (text === '') return '';
  try {
    return emit(parse(text)).s;
  } catch {
    return textFallback(text);
  }
}

/** Parser syntax -> LaTeX for `mathfield.setValue`. Never throws; unparseable input is kept as escaped text. */
export function rawToLatex(raw: string): string {
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  try {
    const { parts, seps } = splitTopLevel(raw);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      out += partToLatex(parts[i]);
      if (i < seps.length) out += seps[i] === ',' ? ',' : (COMPARISON[seps[i]] ?? seps[i]);
    }
    return out;
  } catch {
    return textFallback(raw.trim());
  }
}
