import { compileExpression, type CompiledExpr } from '../engine/evaluator';
import type { LimitResult } from '../engine/limit';
import { solveIvp, stepIvp, type OdeMethod, type OdeResult } from '../engine/ode';
import { parse, type ExpressionNode } from '../engine/parser';
import { sequenceLimit, seriesSum, type Term } from '../engine/series';
import { substitute } from '../engine/symbolic-diff';
import { taylorCoefficients, TaylorError } from '../engine/taylor';
import { formatValue } from '../utils/format-value';

/** View builders for the Taylor / ODE / Series modes of the Calculus tool (pure, no signals). */

/** "1", "∞", "-∞", "does not exist", "could not determine". */
export function limitText(r: LimitResult): string {
  if (r.status === 'dne') return 'does not exist';
  if (r.status === 'unknown') return 'could not determine';
  return formatValue(r.value);
}

export type OdeSolver = 'rk45' | OdeMethod;

export interface TaylorView {
  fnIndex: number;
  color: string;
  center: number;
  order: number;
  coefficients: number[];
  /** P_n(x) in powers of (x − a), zero terms dropped; null when the coefficients are unusable. */
  polynomial: ExpressionNode | null;
  evaluate: (x: number) => number;
  /** Plain-text P_n(x) for aria labels. */
  text: string;
  message: string | null;
}

export interface OdeRow {
  n: number;
  x: number;
  y: number;
}

export interface OdeView {
  slope: (x: number, y: number) => number;
  x0: number;
  y0: number;
  method: OdeSolver;
  h: number | null;
  xEnd: number | null;
  end: OdeResult | null;
  rows: OdeRow[];
  text: string | null;
  error: string | null;
}

export interface SeriesRow {
  n: number;
  a: number;
  s: number;
}

export interface SeriesView {
  term: Term;
  n0: number;
  limit: LimitResult;
  limitText: string;
  sum: LimitResult;
  sumText: string;
  rows: SeriesRow[];
  message: string | null;
  error: string | null;
}

/** Rows listed for a fixed-step table. */
export const MAX_ODE_ROWS = 200;
const SERIES_ROWS = 10;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => String(k).replace(/\d/g, (d) => SUP[Number(d)]);

const num = (value: number): ExpressionNode => ({ type: 'NumberLiteral', value });
const x: ExpressionNode = { type: 'Variable', name: 'x' };
const bin = (operator: string, left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({
  type: 'BinaryOp',
  operator,
  left,
  right,
});
const neg = (operand: ExpressionNode): ExpressionNode => ({
  type: 'UnaryOp',
  operator: '-',
  operand,
});

/** p/q for a coefficient that is a simple fraction (1/6, 1/24), else null. */
function asFraction(c: number): [number, number] | null {
  if (Number.isInteger(c)) return null;
  for (let q = 2; q <= 5040; q++) {
    const p = Math.round(c * q);
    if (p !== 0 && Math.abs(c * q - p) < 1e-9 * Math.max(1, Math.abs(p))) return [p, q];
  }
  return null;
}

/** One term |c|·(x − a)^k as AST and text (the sign is added by the caller). */
function taylorTerm(abs: number, a: number, k: number): { ast: ExpressionNode; text: string } {
  const fr = asFraction(abs);
  const bare = abs === 1 && k > 0;
  const coefAst: ExpressionNode | null = fr
    ? bin('/', num(fr[0]), num(fr[1]))
    : bare
      ? null
      : num(abs);
  const coefText = fr ? `${fr[0]}/${fr[1]}` : bare ? '' : formatValue(abs);
  if (k === 0) return { ast: coefAst!, text: coefText };
  const base = a === 0 ? x : bin(a > 0 ? '-' : '+', x, num(Math.abs(a)));
  const baseText = a === 0 ? 'x' : `(x ${a > 0 ? '−' : '+'} ${formatValue(Math.abs(a))})`;
  const power = k === 1 ? base : bin('^', base, num(k));
  const powText = baseText + (k === 1 ? '' : sup(k));
  return coefAst
    ? { ast: bin('*', coefAst, power), text: `${coefText}${fr ? '·' : ''}${powText}` }
    : { ast: power, text: powText };
}

export function buildTaylorView(
  ast: ExpressionNode,
  fnIndex: number,
  color: string,
  center: number,
  order: number,
): TaylorView {
  const view: TaylorView = {
    fnIndex,
    color,
    center,
    order,
    coefficients: [],
    polynomial: null,
    evaluate: () => NaN,
    text: '',
    message: null,
  };
  let coefficients: number[];
  try {
    coefficients = taylorCoefficients(ast, center, order);
  } catch (e) {
    if (!(e instanceof TaylorError)) throw e;
    view.message = e.message;
    return view;
  }
  view.coefficients = coefficients;
  if (!coefficients.every(Number.isFinite)) {
    view.message = `f is not analytic at x = ${formatValue(center)}.`;
    return view;
  }
  view.evaluate = (t) => coefficients.reduceRight((acc, c) => acc * (t - center) + c, 0);
  let poly: ExpressionNode | null = null;
  let text = '';
  coefficients.forEach((c, k) => {
    if (c === 0) return;
    const t = taylorTerm(Math.abs(c), center, k);
    poly = poly ? bin(c < 0 ? '-' : '+', poly, t.ast) : c < 0 ? neg(t.ast) : t.ast;
    text += text ? ` ${c < 0 ? '−' : '+'} ${t.text}` : (c < 0 ? '−' : '') + t.text;
  });
  view.polynomial = poly ?? num(0);
  view.text = text || '0';
  return view;
}

/** Compiles the parsed text, rejecting names the evaluator does not know (it throws lazily). */
function compileProbed(ast: ExpressionNode): CompiledExpr {
  const compiled = compileExpression(ast);
  try {
    compiled(NaN, NaN);
  } catch (e) {
    if (e instanceof Error && /^Unknown (variable|function)/.test(e.message)) throw e;
  }
  return compiled;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface OdeInput {
  slopeText: string;
  x0: number | null;
  y0: number | null;
  method: OdeSolver;
  h: { value: number | null; invalid: boolean };
  xEnd: { value: number | null; invalid: boolean };
}

export function buildOdeView(i: OdeInput): OdeView {
  const view: OdeView = {
    slope: () => NaN,
    x0: i.x0 ?? NaN,
    y0: i.y0 ?? NaN,
    method: i.method,
    h: i.h.value,
    xEnd: i.xEnd.value,
    end: null,
    rows: [],
    text: null,
    error: null,
  };
  let f: CompiledExpr;
  try {
    if (!i.slopeText.trim()) throw new Error('Enter y′ = f(x, y).');
    f = compileProbed(parse(i.slopeText));
  } catch (e) {
    view.error = `y′: ${errText(e)}`;
    return view;
  }
  view.slope = (a, b) => {
    try {
      return f(a, b);
    } catch {
      return NaN;
    }
  };
  if (i.x0 === null || i.y0 === null || !Number.isFinite(i.x0) || !Number.isFinite(i.y0)) {
    view.error = 'x₀ and y₀ must be finite numbers.';
    return view;
  }
  if (i.xEnd.invalid || (i.xEnd.value !== null && !Number.isFinite(i.xEnd.value))) {
    view.error = 'The target x must be a finite number (or empty).';
    return view;
  }
  const fixed = i.method !== 'rk45';
  const h = i.h.value;
  if (fixed && (h === null || h === 0 || !Number.isFinite(h))) {
    view.error = 'The step h must be a nonzero finite number.';
    return view;
  }
  const xEnd = i.xEnd.value;
  if (xEnd === null) return view;
  try {
    if (!fixed) {
      view.end = solveIvp(f, i.x0, i.y0, [xEnd])[0];
    } else {
      const method = i.method as OdeMethod;
      const hAbs = Math.abs(h!);
      view.end = stepIvp(f, i.x0, i.y0, xEnd, method, hAbs);
      const steps = Math.round(Math.abs(xEnd - i.x0) / hAbs);
      const step = steps ? (xEnd - i.x0) / steps : 0;
      // Each row re-runs the first n steps (stepIvp is the single source of the table values).
      for (let n = 0; n <= Math.min(steps, MAX_ODE_ROWS - 1); n++) {
        const xn = n === steps ? xEnd : i.x0 + n * step;
        const r =
          n === 0 ? { value: i.y0, status: 'ok' } : stepIvp(f, i.x0, i.y0, xn, method, step);
        if (r.status !== 'ok') break;
        view.rows.push({ n, x: xn, y: r.value });
      }
      if (steps >= MAX_ODE_ROWS) {
        view.text = `Showing the first ${MAX_ODE_ROWS} of ${steps + 1} steps. `;
      }
    }
  } catch (e) {
    view.error = errText(e);
    return view;
  }
  const end = view.end;
  const at = `y(${formatValue(xEnd)})`;
  view.text =
    (view.text ?? '') +
    (end.status === 'ok'
      ? `${at} ≈ ${formatValue(end.value)}`
      : end.status === 'blow-up'
        ? `${at}: the solution blows up before reaching x = ${formatValue(xEnd)}.`
        : `${at}: f stops being defined before reaching x = ${formatValue(xEnd)}.`);
  return view;
}

/**
 * shortcut: explicit terms aₙ = g(n) only, no recurrences (a(n+1) = …); the engine supports them
 * (series.ts `recurrence`) but they need seed inputs, add them if the panel grows a seeds field.
 */
export function buildSeriesView(termText: string, start: number | null): SeriesView {
  const unknown: LimitResult = { value: NaN, status: 'unknown' };
  const view: SeriesView = {
    term: () => NaN,
    n0: start ?? NaN,
    limit: unknown,
    limitText: '',
    sum: unknown,
    sumText: '',
    rows: [],
    message: null,
    error: null,
  };
  if (start === null || !Number.isInteger(start) || Math.abs(start) > 1e6) {
    view.error = 'The first index must be an integer between −1000000 and 1000000.';
    return view;
  }
  let F: CompiledExpr;
  try {
    if (!termText.trim()) throw new Error('Enter aₙ in n.');
    // n travels as the evaluator's second variable (y), as in data/exercises/run-exercise.ts.
    F = compileProbed(
      substitute(parse(termText), { n: { type: 'Variable', name: 'y' } }) as ExpressionNode,
    );
  } catch (e) {
    view.error = `aₙ: ${errText(e)}`;
    return view;
  }
  // x = NaN: a stray x in the term makes aₙ undefined instead of silently 0.
  const term: Term = (n) => {
    try {
      return F(NaN, n);
    } catch {
      return NaN;
    }
  };
  view.term = term;
  if (Number.isNaN(term(start))) {
    view.message = `aₙ is undefined at n = ${start}.`;
    return view;
  }
  view.limit = sequenceLimit(term, start);
  view.sum = seriesSum(term, start);
  view.limitText = limitText(view.limit);
  view.sumText = limitText(view.sum);
  let s = 0;
  for (let n = start; n < start + SERIES_ROWS; n++) {
    const a = term(n);
    s += a;
    view.rows.push({ n, a, s });
  }
  return view;
}
