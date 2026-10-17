import { computeAreaRegions } from '../../engine/area-splitter';
import { areaSingle } from '../../engine/calculus';
import { solveConicForY } from '../../engine/conic-solver';
import { findExtrema, findRoots } from '../../engine/critical-points';
import {
  lineAt,
  newton,
  slopeAt,
  slopeFormula,
  tangentLine,
  type DifferentialCurve,
} from '../../engine/differential';
import {
  compileExpression,
  evalConstantExpression,
  evaluate,
  type CompiledExpr,
} from '../../engine/evaluator';
import { findIntersections } from '../../engine/intersection-finder';
import { detectCurveMode, type DetectedCurveMode } from '../../engine/mode-detector';
import { parse, type ExpressionNode } from '../../engine/parser';
import { computeLimit, type LimitResult } from '../../engine/limit';
import { findAxisCrossings } from '../../engine/numeric-utils';
import { solveIvp, stepIvp, type OdeResult } from '../../engine/ode';
import { integrateAdaptive, type QuadratureResult } from '../../engine/quadrature';
import { partialSum, recurrence, sequenceLimit, seriesSum, type Term } from '../../engine/series';
import { computeSolid, type AxisLine, type SolidSpec } from '../../engine/solids';
import { validateSolidSpec } from '../../engine/solids/solid-validation';
import { substitute } from '../../engine/symbolic-diff';
import { taylorCoefficients, TaylorError } from '../../engine/taylor';
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
  'riemann',
]);

/** Planned syntax (see exercise.types.ts): reported as a gap, not as a typo. */
const PLANNED_IDENTIFIERS = new Set(['if', 'asinh', 'acosh', 'atanh', 'cbrt', 'int']);
const CONSTANT_NAMES = new Set(['e', 'pi', 'π']);
const CURVE_VARIABLES = new Set(['x', 'y', 't']);
const SPECIAL_VALUES: Record<string, number> = { inf: Infinity, '-inf': -Infinity, dne: NaN };

// shortcut: bounds omitted → intersections/roots are searched only in [-W, W]; widen if a
// dataset exercise needs a region outside it.
const SEARCH_W = 20;
const SEARCH_STEPS = 4000;
const DEFAULT_TOL = 1e-4;
// Engine root/extremum locators are accurate to ~1e-8; a zero answer needs an absolute floor.
const ABS_FLOOR = 1e-6;
/** Function answers are compared on these x (or y, t) samples; irrational offsets dodge poles. */
const FN_SAMPLES = [
  ...Array.from({ length: 49 }, (_, i) => -6 + (12 * (i + 0.3183)) / 48),
  ...Array.from({ length: 21 }, (_, i) => -1 + (2 * (i + 0.2718)) / 20),
  ...Array.from({ length: 41 }, (_, i) => -12 + (24 * (i + 0.1414)) / 40),
];
/** A derivative given as a function must match on at least this many defined sample points. */
const MIN_FN_POINTS = 4;

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
  /** Parametric only: [x(t), y(t)]. */
  parts?: [ExpressionNode, ExpressionNode];
}

/** Runs one exercise through the calculator engine. Never throws. */
export function runExercise(ex: Exercise): ExerciseRun {
  try {
    const op = ex.op;
    if (UNSUPPORTED_OPS.has(op.kind)) return { status: 'unsupported', feature: op.kind };
    if (op.kind === 'area' && op.wrt === 'y') {
      return { status: 'unsupported', feature: 'area:wrt-y' };
    }
    // Related rates: x and y each defined by an equation in t (Thomas 11.2).
    if (op.kind === 'tangent' && ex.curves.length === 2) {
      return { status: 'unsupported', feature: 'tangent:implicit-in-t' };
    }
    if (op.kind === 'ode') return runOde(ex, op);
    if (op.kind === 'sequence' || op.kind === 'series') return runSequence(ex, op);
    const curves = ex.curves.map(prepareCurve);
    if (op.kind === 'taylor') return runTaylor(ex, op, curves);
    if (op.kind === 'graph') return runGraph(ex, curves);
    if (op.kind === 'derivative' || op.kind === 'tangent') return runSlope(ex, op, curves);

    const expectedFn = op.kind === 'antiderivative' ? ex.expected?.fn : undefined;
    const expected = expectedFn
      ? antiderivativeExpected(expectedFn, op as ExerciseOp & { a: string; b: string })
      : ex.expected?.values?.map(constant);

    const got = compute(op, curves);
    if (!expected) return { status: 'ran', got };
    const tol = ex.expected?.tol ?? DEFAULT_TOL;
    const ok = sameValues(got, expected, tol, printedPrecision(ex.expected?.values));
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
    case 'explicit': {
      const rhs = trimmed.replace(/^[yY]\s*=\s*/, '');
      // `y = f(x, y)` is an implicit equation, but the function row reads every `y = …` as explicit.
      if (/(?<![A-Za-z0-9_])y(?![A-Za-z0-9_])/.test(rhs))
        throw new Unsupported('syntax:y-equals-implicit');
      return one(rhs, ['x']);
    }
    case 'explicit-y':
      return one(trimmed.replace(/^[xX]\s*=\s*/, ''), ['y']);
    case 'polar':
      return one(trimmed.replace(/^r\s*=\s*/i, ''), ['x', 't']);
    case 'parametric': {
      const parts = raw.split(',');
      if (parts.length !== 2) throw new ParseFail(`'${raw}': parametric needs exactly one comma`);
      const xs = parseChecked(parts[0].trim().replace(/^[xX]\s*=\s*/, ''), ['t', 'x']);
      const ys = parseChecked(parts[1].trim().replace(/^[yY]\s*=\s*/, ''), ['t', 'x']);
      const fns = [compileExpression(xs), compileExpression(ys)];
      return { raw, mode, fns, ast: null, parts: [xs, ys] };
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
      if (op.kind !== 'extrema') return xs;
      // findExtrema also reports f′ = 0 at the interval ends; textbooks list interior extrema only.
      const edge = 1e-7 * (b - a);
      return xs.filter((x) => x - a > edge && b - x > edge);
    }
    case 'newton': {
      explicitFns(curves, op.kind, 1);
      if (curves.length !== 1) throw new ParseFail('newton needs exactly one curve');
      return [newton(curves[0].ast!, constant(op.x0), op.steps).value];
    }
    case 'limit': {
      if (curves.length !== 1) throw new ParseFail('limit needs exactly one curve');
      const [f] = explicitFns(curves, op.kind, 1);
      const r = computeLimit(f, constant(op.x0), op.side);
      if (r.status === 'unknown') throw new Fail('limit: the engine cannot decide (unknown)');
      return [r.value];
    }
    default:
      throw new Unsupported(op.kind);
  }
}

// ---------------------------------------------------------------- derivative / tangent

/** The row as the differential tools read it. */
function differentialCurve(c: Curve, kind: string): DifferentialCurve {
  switch (c.mode) {
    case 'explicit':
      return { mode: 'explicit', f: c.ast! };
    case 'explicit-y':
      return { mode: 'explicit-y', g: c.ast! };
    case 'polar':
      return { mode: 'polar', r: c.ast! };
    case 'parametric':
      return { mode: 'parametric', x: c.parts![0], y: c.parts![1] };
    case 'implicit':
      if (c.ast?.type === 'BinaryOp' && c.ast.operator === '=') {
        return { mode: 'implicit', lhs: c.ast.left, rhs: c.ast.right };
      }
      throw new Unsupported(`${kind}:inequality`);
  }
}

/** Slope at a point (`values`) and/or the derivative or tangent line as a function (`fn`). */
function runSlope(
  ex: Exercise,
  op: Extract<ExerciseOp, { kind: 'derivative' | 'tangent' }>,
  curves: Curve[],
): ExerciseRun {
  if (curves.length !== 1) throw new ParseFail(`${op.kind} needs exactly one curve`);
  const c = curves[0];
  const curve = differentialCurve(c, op.kind);
  const order = op.kind === 'derivative' ? (op.order ?? 1) : 1;
  const want = ex.expected;
  const tol = want?.tol ?? DEFAULT_TOL;

  let got: number[] | undefined;
  let fnError: string | null = null;
  if (op.x0 !== undefined) {
    const at = constant(op.x0);
    const y0 = op.y0 === undefined ? undefined : constant(op.y0);
    if (op.kind === 'tangent') {
      const line = tangentLine(curve, at, { y0, normal: op.normal });
      got = [line.slope];
      if (want?.fn) {
        const points = [-1.37, 0.5, 2.21].map((dx): [number, number] => [line.x0 + dx, NaN]);
        fnError = compareFn(points, (x) => lineAt(line, x), expectedFn(want.fn, ['x']), tol, 3);
      }
    } else {
      if (want?.fn) throw new ParseFail('derivative: an fn answer takes no x0');
      got = [slopeAt(curve, at, { y0, order }).value];
    }
  } else {
    if (want?.values) throw new ParseFail('derivative: values need x0');
    const formula = compileExpression(slopeFormula(curve, order));
    if (want?.fn) {
      const vars =
        c.mode === 'implicit' ? ['x', 'y'] : c.mode === 'explicit-y' ? ['y'] : ['x', 't'];
      fnError = compareFn(samplePoints(c), formula, expectedFn(want.fn, vars), tol, MIN_FN_POINTS);
    }
  }

  if (!want?.values && !want?.fn) return { status: 'ran', got };
  const expected = want.values?.map(constant);
  if (expected && got && !sameValues(got, expected, tol, printedPrecision(want.values))) {
    return { status: 'mismatch', got, expected, message: `got [${got}] expected [${expected}]` };
  }
  if (fnError) return { status: 'mismatch', got, expected, message: fnError };
  return { status: 'ok', got, expected };
}

/** An `fn` answer (a leading `y =` is allowed) in the given variables. */
function expectedFn(fn: string, vars: string[]): CompiledExpr {
  return compileExpression(parseChecked(fn.trim().replace(/^[yY]\s*=\s*/, ''), vars));
}

/** Evaluator arguments (a, b) where a derivative formula of the row is compared. */
function samplePoints(c: Curve): Array<[number, number]> {
  if (c.mode === 'explicit-y') return FN_SAMPLES.map((y) => [NaN, y]);
  if (c.mode !== 'implicit') return FN_SAMPLES.map((v) => [v, NaN]);
  // Points on the curve: every y in [-10, 10] with F(x, y) = 0, at every other sample x.
  const F = c.fns[0];
  return FN_SAMPLES.filter((_, i) => i % 2 === 0).flatMap((x) =>
    findAxisCrossings((y) => F(x, y), -10, 10, 0, 400).map((y): [number, number] => [x, y]),
  );
}

/** null when got ≈ expected wherever both are finite, on at least `min` points; else why not. */
function compareFn(
  points: Array<[number, number]>,
  got: CompiledExpr,
  expected: CompiledExpr,
  tol: number,
  min: number,
): string | null {
  let compared = 0;
  for (const [a, b] of points) {
    const g = safe(got, a, b);
    const e = safe(expected, a, b);
    if (!Number.isFinite(g) || !Number.isFinite(e)) continue;
    if (Math.abs(g - e) > Math.max(tol * Math.abs(e), ABS_FLOOR)) {
      return `fn differs at (${a}, ${b}): got ${g} expected ${e}`;
    }
    compared++;
  }
  return compared >= min ? null : `fn: only ${compared} comparable sample points`;
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
  if (op.kind === 'surface' && op.lateral) throw new Unsupported('surface:lateral');
  if (op.shape === 'circle') throw new Unsupported(`${op.kind}:shape-circle`);
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

// ---------------------------------------------------------------- taylor / ode / sequences

/** Value and/or function answers checked together, as `runSlope` does. */
function verdict(
  ex: Exercise,
  got: number[] | undefined,
  fnError: string | null | undefined,
  ordered = false,
): ExerciseRun {
  const want = ex.expected;
  if (!want?.values && !want?.fn) return { status: 'ran', got };
  // undefined = an fn answer the caller did not compare: never report ok for it.
  if (want.fn && fnError === undefined) throw new Unsupported(`${ex.op.kind}:fn-answer`);
  const expected = want.values?.map(constant);
  if (expected && !got) throw new ParseFail(`${ex.op.kind}: a values answer needs a point`);
  if (!expected && !want.fn) throw new ParseFail(`${ex.op.kind}: nothing to compare`);
  const tol = want.tol ?? DEFAULT_TOL;
  if (
    expected &&
    got &&
    !sameValues(got, expected, tol, printedPrecision(want.values), ordered)
  ) {
    return { status: 'mismatch', got, expected, message: `got [${got}] expected [${expected}]` };
  }
  if (fnError) return { status: 'mismatch', got, expected, message: fnError };
  return { status: 'ok', got, expected };
}

function runTaylor(
  ex: Exercise,
  op: Extract<ExerciseOp, { kind: 'taylor' }>,
  curves: Curve[],
): ExerciseRun {
  if (curves.length !== 1 || curves[0].mode !== 'explicit') {
    throw new ParseFail('taylor needs one y = f(x) curve');
  }
  if (!ex.expected?.fn) throw new ParseFail('taylor: the answer is a polynomial in fn');
  const center = constant(op.center);
  let coeffs: number[];
  try {
    coeffs = taylorCoefficients(curves[0].ast!, center, op.order);
  } catch (err) {
    if (err instanceof TaylorError) throw new Unsupported('taylor:function');
    throw err;
  }
  const tol = ex.expected.tol ?? DEFAULT_TOL;
  const expectedAst = parseChecked(ex.expected.fn.trim().replace(/^[yY]\s*=\s*/, ''), ['x']);
  // Compare coefficients (a sampled comparison misses a dropped or extra high-order term); the
  // two extra orders of the expected polynomial must vanish.
  let want: number[] = [];
  try {
    want = taylorCoefficients(expectedAst, center, op.order + 2);
  } catch (err) {
    if (!(err instanceof TaylorError)) throw err;
  }
  if (want.length && want.every(Number.isFinite)) {
    const got = [...coeffs, 0, 0];
    for (let k = 0; k < want.length; k++) {
      if (Math.abs(got[k] - want[k]) > Math.max(tol * Math.abs(want[k]), ABS_FLOOR)) {
        const message = `coefficient of (x - c)^${k}: got ${got[k]} expected ${want[k]}`;
        return { status: 'mismatch', got: coeffs, expected: want, message };
      }
    }
    return { status: 'ok', got: coeffs, expected: want };
  }
  // shortcut: an expected fn that is not a polynomial series falls back to sampling near the center.
  const poly: CompiledExpr = (x) => coeffs.reduceRight((acc, c) => acc * (x - center) + c, 0);
  const points = FN_SAMPLES.slice(49, 70).map((s): [number, number] => [center + 1.5 * s, NaN]);
  return verdict(ex, undefined, compareFn(points, poly, expectedFn(ex.expected.fn, ['x']), tol, 5));
}

function runOde(ex: Exercise, op: Extract<ExerciseOp, { kind: 'ode' }>): ExerciseRun {
  if (ex.curves.length) throw new ParseFail('ode: the equation goes in op.f, not in curves');
  const f = compileExpression(parseChecked(op.f, ['x', 'y']));
  const x0 = constant(op.x0);
  const y0 = constant(op.y0);
  const tol = ex.expected?.tol ?? DEFAULT_TOL;

  let got: number[] | undefined;
  if (op.xEnd !== undefined) {
    const xEnd = constant(op.xEnd);
    let r: OdeResult;
    if (op.method) {
      if (op.h === undefined) throw new ParseFail(`ode: ${op.method} needs h`);
      r = stepIvp(f, x0, y0, xEnd, op.method, constant(op.h));
    } else {
      [r] = solveIvp(f, x0, y0, [xEnd]);
    }
    got = [r.value];
  }
  let fnError: string | null = null;
  if (ex.expected?.fn) {
    if (op.method) throw new ParseFail('ode: an fn answer is the exact solution (no method)');
    const xs = FN_SAMPLES.slice(0, 70).map((s) => x0 + s);
    const sol = new Map(solveIvp(f, x0, y0, xs).map((r, i) => [xs[i], r]));
    const solution: CompiledExpr = (x) => {
      const r = sol.get(x);
      return r?.status === 'ok' ? r.value : NaN;
    };
    const points = xs.map((x): [number, number] => [x, NaN]);
    fnError = compareFn(points, solution, expectedFn(ex.expected.fn, ['x']), tol, MIN_FN_POINTS);
  }
  return verdict(ex, got, fnError);
}

/** `a(3) = 1` (seed) or `a(n+2) = …` (rule); also `a(n) = …`, rejected below. */
const RECURRENCE_ROW = /^\s*([a-z])\(\s*(?:n\s*(?:\+\s*(\d+)\s*)?|(\d+)\s*)\)\s*=(.*)$/;

/** aₙ from one explicit row in n (and x when `withX`), or from seed rows + one recurrence row. */
function sequenceTerm(rows: string[], withX: boolean): (x: number) => Term {
  const matches = rows.map((r) => RECURRENCE_ROW.exec(r));
  if (rows.length === 1 && !matches[0]) {
    // n → y, so the compiled closure reads (x, n).
    const ast = substitute(parseChecked(rows[0], withX ? ['n', 'x'] : ['n']), {
      n: { type: 'Variable', name: 'y' },
    });
    const F = compileExpression(ast);
    return (x) => (n) => F(x, n);
  }
  if (withX || matches.some((m) => !m)) throw new ParseFail('sequence: mixed row forms');
  const name = matches[0]![1];
  const seeds = new Map<number, number>();
  let rule: { order: number; text: string } | undefined;
  for (const [, id, shift, index, rhs] of matches as RegExpExecArray[]) {
    if (id !== name) throw new ParseFail(`sequence: rows name both '${name}' and '${id}'`);
    if (index !== undefined) seeds.set(Number(index), constant(rhs));
    else if (rule) throw new ParseFail('sequence: two recurrence rules');
    else rule = { order: Number(shift ?? 0), text: rhs };
  }
  if (!rule || rule.order < 1) throw new ParseFail('sequence: needs a(n+k) = … with k ≥ 1');
  const indices = [...seeds.keys()].sort((p, q) => p - q);
  const nStart = indices[0];
  if (indices.length > rule.order) {
    throw new ParseFail('sequence: more seeds than the recurrence order (they would override it)');
  }
  if (indices.length < rule.order || indices.some((k, i) => k !== nStart + i)) {
    throw new ParseFail('sequence: seeds must be consecutive and cover the order');
  }
  // a(n+j) → w<j>, so the rule is an ordinary expression in n, w0…w<order−1>.
  const slots = Array.from({ length: rule.order }, (_, j) => `w${j}`);
  const call = new RegExp(`\\b${name}\\(\\s*n\\s*(?:\\+\\s*(\\d+)\\s*)?\\)`, 'g');
  const text = rule.text.replace(call, (_, j?: string) => ` ${slots[Number(j ?? 0)] ?? '?'} `);
  const ast = parseChecked(text, ['n', ...slots]);
  const term = recurrence(
    indices.map((k) => seeds.get(k)!),
    nStart,
    rule.order,
    (m, w) => evaluate(ast, { n: m, ...Object.fromEntries(w.map((v, j) => [slots[j], v])) }),
  );
  return () => term;
}

function runSequence(
  ex: Exercise,
  op: Extract<ExerciseOp, { kind: 'sequence' | 'series' }>,
): ExerciseRun {
  if (!ex.curves.length) throw new ParseFail(`${op.kind} needs aₙ in curves`);
  const nStart = op.nStart ?? 1;
  const limitValue = (r: LimitResult): number => {
    if (r.status === 'unknown') throw new Fail(`${op.kind}: the engine cannot decide (unknown)`);
    return r.value;
  };

  if (ex.expected?.fn && !(op.kind === 'series' && op.nMax === undefined)) {
    if (op.kind === 'series') throw new ParseFail('series: an fn answer is the infinite sum');
    throw new Unsupported('sequence:fn-answer');
  }
  if (op.kind === 'series' && ex.expected?.fn) {
    const termAt = sequenceTerm(ex.curves, true);
    // Outside the interval of convergence the sum is not 'finite' and the point is skipped.
    const sum: CompiledExpr = (x) => {
      const r = seriesSum(termAt(x), nStart);
      return r.status === 'finite' ? r.value : NaN;
    };
    const xs = [...FN_SAMPLES];
    const converged = xs.filter((x) => Number.isFinite(sum(x, NaN)));
    if (converged.length >= 1 && converged.length < MIN_FN_POINTS) {
      // Narrow interval of convergence: densify between the nearest non-converged samples.
      const sorted = [...FN_SAMPLES].sort(ascending);
      const lo = Math.min(...converged);
      const hi = Math.max(...converged);
      const a = sorted[Math.max(0, sorted.findIndex((x) => x === lo) - 1)];
      const b = sorted[Math.min(sorted.length - 1, sorted.findIndex((x) => x === hi) + 1)];
      xs.push(...linspace(a, b, 18).slice(1, -1));
    }
    const points = xs.map((x): [number, number] => [x, NaN]);
    const tol = ex.expected.tol ?? DEFAULT_TOL;
    const fnError = compareFn(points, sum, expectedFn(ex.expected.fn, ['x']), tol, MIN_FN_POINTS);
    return verdict(ex, undefined, fnError);
  }

  const a = sequenceTerm(ex.curves, false)(NaN);
  let got: number[];
  if (op.kind === 'series') {
    got = [
      op.nMax === undefined ? limitValue(seriesSum(a, nStart)) : partialSum(a, nStart, op.nMax),
    ];
  } else if (op.nMax === undefined) {
    got = [limitValue(sequenceLimit(a, nStart))];
  } else {
    got = Array.from({ length: op.nMax - nStart + 1 }, (_, i) => a(nStart + i));
  }
  return verdict(ex, got, null, true);
}

// ---------------------------------------------------------------- numerics

/** 'divergent' → ±Infinity ('inf'), 'undefined' → NaN ('dne'). */
function quadValue(r: QuadratureResult): number {
  if (r.status === 'divergent') return r.value < 0 ? -Infinity : Infinity;
  if (r.status === 'undefined') return NaN;
  return r.value;
}

/** A rounded decimal answer ('0.239') is only good to half a unit of its last printed digit. */
function printedPrecision(values: string[] | undefined): number {
  let floor = ABS_FLOOR;
  for (const v of values ?? []) {
    const decimals = /^-?\d*\.(\d+)$/.exec(v.trim())?.[1].length;
    if (decimals) floor = Math.max(floor, 0.5 * 10 ** -decimals);
  }
  return floor;
}

function sameValues(
  got: number[],
  expected: number[],
  tol: number,
  absFloor: number,
  ordered = false,
): boolean {
  if (got.length !== expected.length) return false;
  const g = ordered ? got : [...got].sort(ascending);
  const e = ordered ? expected : [...expected].sort(ascending);
  return e.every((ev, i) => {
    const gv = g[i];
    // 'dne' accepts any non-finite engine answer ('divergent' of either sign or 'undefined').
    if (Number.isNaN(ev)) return !Number.isFinite(gv);
    if (!Number.isFinite(ev)) return gv === ev;
    return Math.abs(gv - ev) <= Math.max(tol * Math.abs(ev), absFloor);
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
