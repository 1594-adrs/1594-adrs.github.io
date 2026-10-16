import { computeAreaRegions } from '../../engine/area-splitter';
import { areaSingle } from '../../engine/calculus';
import { solveConicForY } from '../../engine/conic-solver';
import { findExtrema, findRoots } from '../../engine/critical-points';
import {
  compileExpression,
  evalConstantExpression,
  type CompiledExpr,
} from '../../engine/evaluator';
import { findIntersections } from '../../engine/intersection-finder';
import { detectCurveMode, type DetectedCurveMode } from '../../engine/mode-detector';
import { parse, type ExpressionNode } from '../../engine/parser';
import { integrateAdaptive, type QuadratureResult } from '../../engine/quadrature';
import { computeSolid, type AxisLine, type SolidSpec } from '../../engine/solids';
import { validateSolidSpec } from '../../engine/solids/solid-validation';
import { sumRegions } from '../../utils/result-format';
import type { Exercise, ExerciseOp, ExerciseOpKind } from './exercise.types';

export type ExerciseRunStatus = 'ok' | 'ran' | 'mismatch' | 'unsupported' | 'parse-error';

export interface ExerciseRun {
  status: ExerciseRunStatus;
  /** Missing capability, for 'unsupported' (op kind, `syntax:<name>`, `<op>:<detail>`). */
  feature?: string;
  /** Computed answer; ±Infinity for a divergent result, NaN for 'dne'. */
  got?: number[];
  expected?: number[];
  message?: string;
}

/** Ops the calculator has no tool for yet. */
const UNSUPPORTED_OPS = new Set<ExerciseOpKind>([
  'arc-length',
  'polar-area',
  'centroid',
  'derivative',
  'tangent',
  'limit',
  'newton',
  'riemann',
  'taylor',
  'ode',
  'sequence',
  'series',
]);

/** Planned syntax (see exercise.types.ts): reported as a gap, not as a typo. */
const PLANNED_IDENTIFIERS = new Set(['if', 'asinh', 'acosh', 'atanh', 'cbrt']);
const CONSTANT_NAMES = new Set(['e', 'pi', 'π']);
const CURVE_VARIABLES = new Set(['x', 'y', 't']);
const SPECIAL_VALUES: Record<string, number> = { inf: Infinity, '-inf': -Infinity, dne: NaN };

// shortcut: bounds omitted → intersections/roots are searched only in [-W, W]; widen if a
// dataset exercise needs a region outside it.
const SEARCH_W = 20;
const SEARCH_STEPS = 4000;
const DEFAULT_TOL = 1e-4;
const ABS_FLOOR = 1e-9;

class Unsupported extends Error {
  constructor(readonly feature: string) {
    super(feature);
  }
}
/** The exercise text cannot be read (syntax, wrong variable, malformed op). */
class ParseFail extends Error {}
/** The calculator ran but produced no answer. */
class Fail extends Error {}

interface Curve {
  raw: string;
  mode: DetectedCurveMode;
  /** Compiled component(s): one for most modes, [x(t), y(t)] for parametric. */
  fns: CompiledExpr[];
  /** Explicit / explicit-y AST (for solid formulas) or the `lhs = rhs` AST of an implicit equation. */
  ast: ExpressionNode | null;
}

/** Runs one exercise through the calculator engine. Never throws. */
export function runExercise(ex: Exercise): ExerciseRun {
  try {
    const op = ex.op;
    if (UNSUPPORTED_OPS.has(op.kind)) return { status: 'unsupported', feature: op.kind };
    if (op.kind === 'area' && op.wrt === 'y') {
      return { status: 'unsupported', feature: 'area:wrt-y' };
    }
    const curves = ex.curves.map(prepareCurve);
    if (op.kind === 'graph') return runGraph(ex, curves);

    const expectedFn = op.kind === 'antiderivative' ? ex.expected?.fn : undefined;
    const expected = expectedFn
      ? antiderivativeExpected(expectedFn, op as ExerciseOp & { a: string; b: string })
      : ex.expected?.values?.map(constant);

    const got = compute(op, curves);
    if (!expected) return { status: 'ran', got };
    const tol = ex.expected?.tol ?? DEFAULT_TOL;
    const ok = sameValues(got, expected, tol);
    return ok
      ? { status: 'ok', got, expected }
      : { status: 'mismatch', got, expected, message: `got [${got}] expected [${expected}]` };
  } catch (err) {
    if (err instanceof Unsupported) return { status: 'unsupported', feature: err.feature };
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof ParseFail) return { status: 'parse-error', message };
    if (err instanceof Fail) return { status: 'mismatch', message };
    return { status: 'mismatch', message: `engine threw: ${message}` };
  }
}

// ---------------------------------------------------------------- parsing

function checkPlannedSyntax(raw: string): void {
  for (const m of raw.matchAll(/[A-Za-z_]\w*/g)) {
    const id = m[0].toLowerCase();
    if (PLANNED_IDENTIFIERS.has(id)) throw new Unsupported(`syntax:${id}`);
  }
}

function collectVariables(node: ExpressionNode, out: Set<string>): Set<string> {
  switch (node.type) {
    case 'Variable':
      out.add(node.name);
      break;
    case 'BinaryOp':
      collectVariables(node.left, out);
      collectVariables(node.right, out);
      break;
    case 'UnaryOp':
      collectVariables(node.operand, out);
      break;
    case 'FunctionCall':
      collectVariables(node.arg, out);
      break;
    case 'FunctionCallMultiArg':
      for (const arg of node.args) collectVariables(arg, out);
      break;
    case 'PoweredFunctionCall':
      collectVariables(node.arg, out);
      collectVariables(node.power, out);
      break;
    case 'NumberLiteral':
      break;
  }
  return out;
}

/** Parses `text`; free parameters (a, k, n, …) are a gap, x/y/t outside `allowed` a typo. */
function parseChecked(text: string, allowed: readonly string[]): ExpressionNode {
  checkPlannedSyntax(text);
  let ast: ExpressionNode;
  try {
    ast = parse(text);
  } catch (err) {
    throw new ParseFail(`'${text}': ${err instanceof Error ? err.message : String(err)}`);
  }
  for (const name of collectVariables(ast, new Set())) {
    if (CONSTANT_NAMES.has(name) || allowed.includes(name)) continue;
    if (CURVE_VARIABLES.has(name)) throw new ParseFail(`'${text}': variable '${name}' not allowed`);
    throw new Unsupported(`syntax:${name}`);
  }
  return ast;
}

/** Bound / answer: a constant expression, or 'inf' / '-inf' / 'dne'. */
function constant(raw: string): number {
  const key = raw.trim().toLowerCase();
  if (Object.hasOwn(SPECIAL_VALUES, key)) return SPECIAL_VALUES[key];
  parseChecked(raw, []);
  try {
    return evalConstantExpression(raw);
  } catch (err) {
    throw new ParseFail(`'${raw}': ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Mirrors the function-row parsing of graphing-calculator.component.ts `updateExpression`. */
function prepareCurve(raw: string): Curve {
  checkPlannedSyntax(raw);
  const trimmed = raw.trim();
  // The contract allows `(f(t), g(t))` but the calculator only reads `f(t), g(t)`.
  if (/^\(.*\)$/s.test(trimmed) && detectCurveMode(trimmed.slice(1, -1)) === 'parametric') {
    throw new Unsupported('syntax:parametric-parens');
  }
  const mode = detectCurveMode(raw);
  const one = (text: string, allowed: string[]): Curve => {
    const ast = parseChecked(text, allowed);
    return { raw, mode, fns: [compileExpression(ast)], ast };
  };
  switch (mode) {
    case 'explicit':
      return one(trimmed.replace(/^[yY]\s*=\s*/, ''), ['x']);
    case 'explicit-y':
      return one(trimmed.replace(/^[xX]\s*=\s*/, ''), ['y']);
    case 'polar':
      return one(trimmed.replace(/^r\s*=\s*/i, ''), ['x', 't']);
    case 'parametric': {
      const parts = raw.split(',');
      if (parts.length !== 2) throw new ParseFail(`'${raw}': parametric needs exactly one comma`);
      const xs = parseChecked(parts[0].trim().replace(/^[xX]\s*=\s*/, ''), ['t', 'x']);
      const ys = parseChecked(parts[1].trim().replace(/^[yY]\s*=\s*/, ''), ['t', 'x']);
      return { raw, mode, fns: [compileExpression(xs), compileExpression(ys)], ast: null };
    }
    case 'implicit': {
      const ineq = /(.*?)(>=|<=|>|<)(.*)/.exec(raw);
      if (ineq) {
        const lhs = ineq[1].trim();
        const rhs = ineq[3].trim();
        if (/^y$/i.test(lhs)) return one(rhs, ['x']);
        return { ...one(`(${lhs})-(${rhs})`, ['x', 'y']), ast: null };
      }
      const eq = raw.indexOf('=');
      if (eq < 0) return one(raw, ['x', 'y']);
      const lhs = parseChecked(raw.slice(0, eq), ['x', 'y']);
      const rhs = parseChecked(raw.slice(eq + 1), ['x', 'y']);
      const diff = parseChecked(`(${raw.slice(0, eq)})-(${raw.slice(eq + 1)})`, ['x', 'y']);
      return {
        raw,
        mode,
        fns: [compileExpression(diff)],
        ast: { type: 'BinaryOp', operator: '=', left: lhs, right: rhs },
      };
    }
  }
}

function antiderivativeExpected(fn: string, op: { a: string; b: string }): number[] {
  const F = compileExpression(parseChecked(fn.trim().replace(/^[yY]\s*=\s*/, ''), ['x']));
  return [F(constant(op.b), NaN) - F(constant(op.a), NaN)];
}

// ---------------------------------------------------------------- ops

function runGraph(ex: Exercise, curves: Curve[]): ExerciseRun {
  const range = ex.paramRange
    ? linspace(constant(ex.paramRange.a), constant(ex.paramRange.b), 21)
    : linspace(0, 2 * Math.PI, 21);
  const ts = [...linspace(-10, 10, 41), ...range];
  for (const c of curves) {
    const finite = (a: number, b: number) => c.fns.every((f) => Number.isFinite(safe(f, a, b)));
    const drawable =
      c.mode === 'implicit'
        ? ts.some((x) => ts.some((y) => finite(x, y)))
        : c.mode === 'explicit-y'
          ? ts.some((y) => finite(NaN, y))
          : ts.some((t) => finite(t, NaN));
    if (!drawable) return { status: 'mismatch', message: `'${c.raw}' is not finite anywhere` };
  }
  return { status: 'ok' };
}

function compute(op: ExerciseOp, curves: Curve[]): number[] {
  switch (op.kind) {
    case 'integral':
    case 'antiderivative': {
      const [f] = explicitFns(curves, op.kind, 1);
      const [a, b] = finiteBounds(op.kind, op.a, op.b);
      return [quadValue(integrateAdaptive(f, a, b))];
    }
    case 'area':
      return [areaWrtX(curves, op.a, op.b)];
    case 'volume':
    case 'surface':
      return [solid(op, curves)];
    case 'roots':
    case 'extrema':
    case 'intersections': {
      const [a, b] = finiteBounds(op.kind, op.a, op.b);
      const fns = explicitFns(curves, op.kind, op.kind === 'intersections' ? 2 : 1);
      const xs =
        op.kind === 'intersections'
          ? findIntersections(fns, a, b).map((p) => p.x)
          : fns.flatMap((f) =>
              (op.kind === 'roots' ? findRoots : findExtrema)(f, a, b).map((p) => p.x),
            );
      return xs;
    }
    default:
      throw new Unsupported(op.kind);
  }
}

/** y = f(x) curves as functions of x (the input every x-tool of the calculator expects). */
function explicitFns(curves: Curve[], kind: string, min: number): Array<(x: number) => number> {
  if (curves.length < min) throw new ParseFail(`${kind} needs at least ${min} curve(s)`);
  if (kind === 'integral' || kind === 'antiderivative') {
    if (curves.length !== 1) throw new ParseFail(`${kind} needs exactly one curve`);
  }
  return curves.map((c) => {
    if (c.mode !== 'explicit') throw new Unsupported(`${kind}:${c.mode}`);
    const f = c.fns[0];
    return (x: number) => f(x, NaN);
  });
}

/** The app has no infinite bounds: an op given one is a gap, `<op>:infinite-bounds`. */
function finiteBounds(kind: string, aRaw: string, bRaw: string): [number, number] {
  const a = constant(aRaw);
  const b = constant(bRaw);
  if (Number.isNaN(a) || Number.isNaN(b)) throw new ParseFail(`${kind}: bound is 'dne'`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Unsupported(`${kind}:infinite-bounds`);
  return [a, b];
}

/** Area between curves w.r.t. x as the "area between curves" tool computes it. */
function areaWrtX(curves: Curve[], aRaw?: string, bRaw?: string): number {
  if (curves.length === 0) throw new ParseFail('area needs at least one curve');
  if ((aRaw === undefined) !== (bRaw === undefined)) {
    throw new ParseFail('area needs both bounds or none');
  }
  // Same evaluator closures as the component's buildAreaEvalFn: explicit, or a conic's first branch.
  const fns = curves.map((c): ((x: number) => number) => {
    if (c.mode === 'explicit') {
      const f = c.fns[0];
      return (x) => f(x, NaN);
    }
    const branches = c.mode === 'implicit' && c.ast ? solveConicForY(c.ast) : null;
    if (!branches?.length) throw new Unsupported(`area:${c.mode}`);
    const branch = branches[0].fn;
    return (x) => branch(x) ?? NaN;
  });

  let a: number;
  let b: number;
  if (aRaw !== undefined && bRaw !== undefined) {
    [a, b] = finiteBounds('area', aRaw, bRaw);
  } else {
    const xs =
      fns.length === 1
        ? findRoots(fns[0], -SEARCH_W, SEARCH_W).map((p) => p.x)
        : findIntersections(fns, -SEARCH_W, SEARCH_W, SEARCH_STEPS).map((p) => p.x);
    a = Math.min(...xs);
    b = Math.max(...xs);
    if (!(b > a)) throw new Fail(`area: fewer than 2 crossings in [-${SEARCH_W}, ${SEARCH_W}]`);
  }

  if (fns.length === 1) return b > a ? areaSingle(fns[0], a, b) : 0;
  const regions = computeAreaRegions(fns, findIntersections(fns, a, b), a, b);
  const total = sumRegions(regions);
  return total.status === 'undefined' ? NaN : total.value;
}

function solid(op: Extract<ExerciseOp, { kind: 'volume' | 'surface' }>, curves: Curve[]): number {
  const want = op.variable === 'x' ? 'explicit' : 'explicit-y';
  const [a, b] = finiteBounds(op.kind, op.a, op.b);
  if (op.kind === 'surface' && op.method === 'cross-section') {
    throw new Unsupported('surface:cross-section');
  }
  let axis: AxisLine | undefined;
  if (op.axis) axis = { orientation: op.axis.orientation, value: constant(op.axis.value) };
  else if (op.method !== 'cross-section') {
    // Axis omitted = the coordinate axis that fits method + variable (x-axis for disks in x).
    const horizontal = (op.method === 'disk-washer') === (op.variable === 'x');
    axis = { orientation: horizontal ? 'horizontal' : 'vertical', value: 0 };
  }
  const spec: SolidSpec = {
    method: op.method,
    variable: op.variable,
    curves: curves.map((c, i) => {
      if (c.mode !== want) throw new Unsupported(`${op.kind}:${c.mode}`);
      const f = c.fns[0];
      const fn = op.variable === 'x' ? (t: number) => f(t, NaN) : (t: number) => f(NaN, t);
      return { fn, ast: c.ast, label: `f${i + 1}`, color: '' };
    }),
    a,
    b,
    axis,
    shape: op.shape,
    heightRatio: op.heightRatio,
  };
  const errors = validateSolidSpec(spec).filter((i) => i.severity === 'error');
  if (errors.length) throw new Fail(errors.map((i) => `${i.code}: ${i.message}`).join(' | '));

  const res = computeSolid(spec);
  const value = op.kind === 'volume' ? res.volume : res.surfaceArea;
  if (value !== null) return value;
  if (res.issues.some((i) => i.code === 'divergent')) return Infinity;
  if (res.issues.some((i) => i.code === 'undefined-domain')) return NaN;
  throw new Fail(
    `${op.kind} not computed: ${res.issues.map((i) => i.code).join(', ') || 'no value'}`,
  );
}

// ---------------------------------------------------------------- numerics

/** 'divergent' → ±Infinity ('inf'), 'undefined' → NaN ('dne'). */
function quadValue(r: QuadratureResult): number {
  if (r.status === 'divergent') return r.value < 0 ? -Infinity : Infinity;
  if (r.status === 'undefined') return NaN;
  return r.value;
}

function sameValues(got: number[], expected: number[], tol: number): boolean {
  if (got.length !== expected.length) return false;
  const g = [...got].sort(ascending);
  const e = [...expected].sort(ascending);
  return e.every((ev, i) => {
    const gv = g[i];
    // 'dne' accepts any non-finite engine answer ('divergent' of either sign or 'undefined').
    if (Number.isNaN(ev)) return !Number.isFinite(gv);
    if (!Number.isFinite(ev)) return gv === ev;
    return Math.abs(gv - ev) <= Math.max(tol * Math.abs(ev), ABS_FLOOR);
  });
}

function ascending(p: number, q: number): number {
  if (Number.isNaN(p)) return Number.isNaN(q) ? 0 : 1;
  if (Number.isNaN(q)) return -1;
  return p === q ? 0 : p - q;
}

function linspace(a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

function safe(f: CompiledExpr, a: number, b: number): number {
  try {
    return f(a, b);
  } catch {
    return NaN;
  }
}
