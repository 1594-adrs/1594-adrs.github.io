/**
 * View helpers for the f′ row toggle and the tangent-at-trace overlay: which rows can be
 * differentiated (and why not), the tangent / normal at a traced point and its readout text.
 * Pure: no DOM/Angular; the math is in engine/differential.ts and engine/symbolic-diff.ts.
 */
import type { ExpressionNode } from '../engine/parser';
import { compileExpression } from '../engine/evaluator';
import { DifferentiationError, dependsOn, differentiate } from '../engine/symbolic-diff';
import { DifferentialError, tangentLine, type DifferentialCurve } from '../engine/differential';
import type { MathExpression } from '../models/calculator.models';
import { formatValue } from '../utils/format-value';

type AngleUnit = 'rad' | 'deg';

/** Functions whose value depends on the angle unit (the engine differentiates in radians). */
const ANGLE_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'asin',
  'acos',
  'atan',
  'atan2',
]);

export const RADIANS_REASON = 'Switch to RAD: derivatives of trig functions need radians.';

/** True when the expression calls a trig function (its derivative depends on the angle unit). */
export function usesAngleUnit(ast: ExpressionNode): boolean {
  switch (ast.type) {
    case 'NumberLiteral':
    case 'Variable':
      return false;
    case 'BinaryOp':
      return usesAngleUnit(ast.left) || usesAngleUnit(ast.right);
    case 'UnaryOp':
      return usesAngleUnit(ast.operand);
    case 'FunctionCall':
      return ANGLE_FUNCTIONS.has(ast.name) || usesAngleUnit(ast.arg);
    case 'FunctionCallMultiArg':
      return ANGLE_FUNCTIONS.has(ast.name) || ast.args.some(usesAngleUnit);
    case 'PoweredFunctionCall':
      return ANGLE_FUNCTIONS.has(ast.name) || usesAngleUnit(ast.arg) || usesAngleUnit(ast.power);
  }
}

export interface DerivativeInfo {
  /** Whether the row can carry an f′ toggle at all (explicit y = f(x) rows). */
  applicable: boolean;
  /** f′ as an AST, or null with `reason` explaining why. */
  ast: ExpressionNode | null;
  reason: string | null;
  /** Caveat to show under a valid f′ (where the formula hides that f′ is undefined), else null. */
  note: string | null;
}

/** Piecewise-constant calls: the engine differentiates them to 0 (or u′ for mod) off the jumps. */
const JUMP_FUNCTIONS = new Set(['floor', 'ceil', 'round', 'sign', 'mod']);
/** Branch-picking calls: the f′ formula is finite at their corners (ties). */
const CORNER_FUNCTIONS = new Set(['min', 'max']);
const COMPARISONS = new Set(['<', '>', '<=', '>=', '==', '!=']);

function collectBreaks(n: ExpressionNode, jumps: Set<string>, corners: Set<string>): void {
  switch (n.type) {
    case 'NumberLiteral':
    case 'Variable':
      return;
    case 'UnaryOp':
      return collectBreaks(n.operand, jumps, corners);
    case 'BinaryOp':
      if (COMPARISONS.has(n.operator) && dependsOn(n, 'x')) jumps.add('the comparison');
      collectBreaks(n.left, jumps, corners);
      return collectBreaks(n.right, jumps, corners);
    case 'FunctionCall':
    case 'PoweredFunctionCall':
    case 'FunctionCallMultiArg': {
      const args = n.type === 'FunctionCallMultiArg' ? n.args : [n.arg];
      if (args.some((a) => dependsOn(a, 'x'))) {
        if (JUMP_FUNCTIONS.has(n.name)) jumps.add(n.name);
        if (CORNER_FUNCTIONS.has(n.name)) corners.add(n.name);
      }
      if (n.type === 'PoweredFunctionCall') collectBreaks(n.power, jumps, corners);
      for (const a of args) collectBreaks(a, jumps, corners);
    }
  }
}

/** "f′ is undefined at the jumps of floor and the corners of max.", or null. */
export function derivativeNote(ast: ExpressionNode): string | null {
  const jumps = new Set<string>();
  const corners = new Set<string>();
  collectBreaks(ast, jumps, corners);
  const parts: string[] = [];
  if (jumps.size) parts.push(`the jumps of ${[...jumps].join(' and ')}`);
  if (corners.size) parts.push(`the corners of ${[...corners].join(' and ')}`);
  return parts.length ? `f′ is undefined at ${parts.join(' and ')}.` : null;
}

export const UNDEFINED_EVERYWHERE_REASON = 'f is undefined everywhere.';

const derivativeCache = new WeakMap<ExpressionNode, ExpressionNode | string>();

function cachedDerivative(ast: ExpressionNode): ExpressionNode | string {
  const hit = derivativeCache.get(ast);
  if (hit !== undefined) return hit;
  let out: ExpressionNode | string;
  try {
    out = differentiate(ast, 'x');
  } catch (err) {
    if (!(err instanceof DifferentiationError)) throw err;
    out = `No symbolic derivative: ${err.message}.`;
  }
  derivativeCache.set(ast, out);
  return out;
}

/** f′ of a function row, or why it is unavailable. */
export function derivativeOf(fn: MathExpression, angleUnit: AngleUnit): DerivativeInfo {
  const none = (applicable: boolean, reason: string): DerivativeInfo => ({
    applicable,
    ast: null,
    reason,
    note: null,
  });
  if (fn.mode !== 'explicit') return none(false, 'f′ is available for y = f(x) rows only.');
  if (!fn.ast) return none(true, 'Enter a valid f(x) first.');
  // A constant with no value (1/0, sqrt(-1), ln(0)) would otherwise differentiate to a fake 0.
  if (!dependsOn(fn.ast, 'x') && !Number.isFinite(evalConstant(fn.ast, angleUnit))) {
    return none(true, UNDEFINED_EVERYWHERE_REASON);
  }
  if (angleUnit === 'deg' && usesAngleUnit(fn.ast)) return none(true, RADIANS_REASON);
  const d = cachedDerivative(fn.ast);
  return typeof d === 'string'
    ? none(true, d)
    : { applicable: true, ast: d, reason: null, note: derivativeNote(fn.ast) };
}

function evalConstant(ast: ExpressionNode, angleUnit: AngleUnit): number {
  try {
    return compileExpression(ast, angleUnit)(0, 0);
  } catch {
    return NaN;
  }
}

/** The curve a function row describes, for the differential engine (null: not supported). */
export function differentialCurveOf(fn: MathExpression): DifferentialCurve | null {
  switch (fn.mode) {
    case 'explicit':
      return fn.ast ? { mode: 'explicit', f: fn.ast } : null;
    case 'explicit-y':
      return fn.ast ? { mode: 'explicit-y', g: fn.ast } : null;
    case 'polar':
      return fn.ast ? { mode: 'polar', r: fn.ast } : null;
    case 'parametric':
      return fn.paramX && fn.paramY ? { mode: 'parametric', x: fn.paramX, y: fn.paramY } : null;
    default:
      return null;
  }
}

/** Every AST a row evaluates (for the angle-unit check). */
function rowAsts(fn: MathExpression): ExpressionNode[] {
  if (fn.mode === 'parametric') return [fn.paramX, fn.paramY].filter((n) => !!n);
  return fn.ast ? [fn.ast] : [];
}

export type TangentKind = 'finite' | 'vertical' | 'dne' | 'unavailable';

export interface TangentReadout {
  kind: TangentKind;
  x: number;
  y: number;
  /** dy/dx at the point (±Infinity vertical, NaN does not exist). */
  slope: number;
  /** Text lines for the canvas label (point, slope, tangent equation[, normal equation]). */
  lines: string[];
  /** One sentence for screen readers. */
  summary: string;
}

/** "y = 2x - 1", "y = -x", "y = 3", "x = 1.5" (vertical when the slope is infinite). */
export function lineEquation(x0: number, y0: number, slope: number): string {
  if (!Number.isFinite(slope)) return `x = ${formatValue(x0)}`;
  const m = Math.abs(slope) < 1e-10 ? 0 : slope;
  const b = y0 - m * x0;
  const bAbs = Math.abs(b) < 1e-10 ? 0 : b;
  if (m === 0) return `y = ${formatValue(bAbs)}`;
  // Compare the rounded text: a numeric slope of 0.9999999 must still read "x", not "1x".
  const mRaw = formatValue(m);
  const mText = mRaw === '1' ? '' : mRaw === '-1' ? '-' : mRaw;
  if (bAbs === 0) return `y = ${mText}x`;
  return `y = ${mText}x ${bAbs < 0 ? '-' : '+'} ${formatValue(Math.abs(bAbs))}`;
}

/**
 * Tangent (and optionally normal) at the traced point of a row. `at` is x for explicit and
 * x = g(y) rows (with `y0` the traced y), the parameter for parametric / polar rows.
 */
export function tangentAt(
  fn: MathExpression,
  at: number,
  y0: number | undefined,
  angleUnit: AngleUnit,
  withNormal: boolean,
): TangentReadout | null {
  const curve = differentialCurveOf(fn);
  if (!curve) return null;
  if (angleUnit === 'deg' && rowAsts(fn).some(usesAngleUnit)) {
    return {
      kind: 'unavailable',
      x: NaN,
      y: NaN,
      slope: NaN,
      lines: ['Tangent: switch to RAD'],
      summary: RADIANS_REASON,
    };
  }
  let line;
  try {
    line = tangentLine(curve, at, { y0 });
  } catch (err) {
    if (err instanceof DifferentialError || err instanceof DifferentiationError) {
      return {
        kind: 'unavailable',
        x: NaN,
        y: NaN,
        slope: NaN,
        lines: ['No tangent here'],
        summary: `No tangent: ${err.message}.`,
      };
    }
    throw err;
  }
  const { x0: x, y0: y, slope } = line;
  const point = `(${formatValue(x)}, ${formatValue(y)})`;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Number.isNaN(slope)) {
    return {
      kind: 'dne',
      x,
      y,
      slope,
      lines: [point, 'slope does not exist'],
      summary: `At ${point} the derivative does not exist, so there is no tangent line.`,
    };
  }
  if (!Number.isFinite(slope)) {
    const lines = [point, 'vertical tangent', lineEquation(x, y, slope)];
    if (withNormal) lines.push(`normal: y = ${formatValue(y)}`);
    return {
      kind: 'vertical',
      x,
      y,
      slope,
      lines,
      summary: `At ${point} the tangent is vertical: ${lineEquation(x, y, slope)}${withNormal ? `; normal y = ${formatValue(y)}` : ''}.`,
    };
  }
  const tangent = lineEquation(x, y, slope);
  const lines = [point, `m = ${formatValue(slope)}`, tangent];
  const normal = withNormal ? lineEquation(x, y, slope === 0 ? Infinity : -1 / slope) : '';
  if (normal) lines.push(`normal: ${normal}`);
  return {
    kind: 'finite',
    x,
    y,
    slope,
    lines,
    summary: `Tangent at ${point}: slope ${formatValue(slope)}, ${tangent}${normal ? `; normal ${normal}` : ''}.`,
  };
}
