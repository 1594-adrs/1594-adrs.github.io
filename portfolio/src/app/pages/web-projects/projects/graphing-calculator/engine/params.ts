/**
 * Free parameters (sliders): which single-letter names an expression leaves unbound, and
 * substitution of their current values into the AST so every tool sees plain numbers.
 * Pure: no DOM / Angular, no `models/` import.
 */
import { evalConstantExpression } from './evaluator';
import { isParamName, maskNested, sliderName, unwrapParametricPair } from './mode-detector';
import { parse, type ExpressionNode } from './parser';

/** Sorted, unique free-parameter names used by `ast`. */
export function freeParams(ast: ExpressionNode): string[] {
  const out = new Set<string>();
  const walk = (n: ExpressionNode): void => {
    switch (n.type) {
      case 'Variable':
        if (isParamName(n.name)) out.add(n.name);
        return;
      case 'BinaryOp':
        walk(n.left);
        walk(n.right);
        return;
      case 'UnaryOp':
        walk(n.operand);
        return;
      case 'FunctionCall':
        walk(n.arg);
        return;
      case 'PoweredFunctionCall':
        walk(n.arg);
        walk(n.power);
        return;
      case 'FunctionCallMultiArg':
        n.args.forEach(walk);
        return;
      default:
        return;
    }
  };
  walk(ast);
  return [...out].sort();
}

function literal(v: number): ExpressionNode {
  const lit: ExpressionNode = { type: 'NumberLiteral', value: Math.abs(v) };
  // A negative value as unary minus, the shape the parser builds, so printers see `-2`.
  return v < 0 ? { type: 'UnaryOp', operator: '-', operand: lit } : lit;
}

/**
 * `ast` with every parameter found in `values` replaced by its number. Returns the same object
 * when nothing changed, so compile / symbolic caches keyed by AST identity keep hitting.
 */
export function substituteParams(
  ast: ExpressionNode,
  values: ReadonlyMap<string, number>,
): ExpressionNode {
  if (values.size === 0) return ast;
  const sub = (n: ExpressionNode): ExpressionNode => {
    switch (n.type) {
      case 'Variable': {
        const v = isParamName(n.name) ? values.get(n.name) : undefined;
        return v === undefined ? n : literal(v);
      }
      case 'BinaryOp': {
        const left = sub(n.left);
        const right = sub(n.right);
        return left === n.left && right === n.right ? n : { ...n, left, right };
      }
      case 'UnaryOp': {
        const operand = sub(n.operand);
        return operand === n.operand ? n : { ...n, operand };
      }
      case 'FunctionCall': {
        const arg = sub(n.arg);
        return arg === n.arg ? n : { ...n, arg };
      }
      case 'PoweredFunctionCall': {
        const arg = sub(n.arg);
        const power = sub(n.power);
        return arg === n.arg && power === n.power ? n : { ...n, arg, power };
      }
      case 'FunctionCallMultiArg': {
        const args = n.args.map(sub);
        return args.every((a, i) => a === n.args[i]) ? n : { ...n, args };
      }
      default:
        return n;
    }
  };
  return sub(ast);
}

/**
 * Free parameters of a whole row text: the pieces between top-level `=`, `<`, `>`, `,` are
 * parsed separately (a piece that does not parse contributes nothing; its error shows anyway).
 */
export function rowFreeParams(raw: string): string[] {
  const text = unwrapParametricPair(raw);
  const mask = maskNested(text);
  const out = new Set<string>();
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && !'=<>,!'.includes(mask[i])) continue;
    const piece = text.slice(start, i);
    start = i + 1;
    if (!piece.trim()) continue;
    try {
      for (const p of freeParams(parse(piece))) out.add(p);
    } catch {
      // unparsable piece: the row's own parse error is reported instead
    }
  }
  return [...out].sort();
}

export interface SliderRowValue {
  name: string;
  value: number | null;
  error: string | null;
}

export interface SliderEnv {
  /** Valid slider values by name. */
  values: Map<string, number>;
  /** Names some slider row defines (valid or not). */
  claimed: Set<string>;
  /** Per row: the slider it defines, or null for non-slider rows. */
  rows: (SliderRowValue | null)[];
}

/** Reads every slider row: first definition wins, a later one gets "a is already defined". */
export function sliderEnv(raws: readonly string[]): SliderEnv {
  const values = new Map<string, number>();
  const claimed = new Set<string>();
  const rows = raws.map((raw): SliderRowValue | null => {
    const name = sliderName(raw);
    if (!name) return null;
    if (claimed.has(name)) return { name, value: null, error: `${name} is already defined` };
    claimed.add(name);
    const rhs = raw.slice(raw.indexOf('=') + 1);
    try {
      const value = evalConstantExpression(rhs);
      values.set(name, value);
      return { name, value, error: null };
    } catch (err) {
      // shortcut: the RHS must be constant, so `b = 2a` is not supported; upgrade when someone asks.
      const usesParams = rowFreeParams(rhs).length > 0;
      const message = err instanceof Error ? err.message : String(err);
      return { name, value: null, error: usesParams ? 'Slider value must be a number' : message };
    }
  });
  return { values, claimed, rows };
}

/** Decimal places implied by a step (0.1 -> 1, 0.25 -> 2, 5 -> 0), capped at 10. */
export function stepDecimals(step: number): number {
  for (let d = 0; d < 10; d++) {
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d;
  }
  return 10;
}

/** `v` printed to the step's precision, without trailing zeros or exponent (`2`, `-0.5`). */
export function formatSliderValue(v: number, step: number): string {
  const s = v.toFixed(stepDecimals(step));
  const trimmed = s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  return trimmed === '-0' ? '0' : trimmed;
}
