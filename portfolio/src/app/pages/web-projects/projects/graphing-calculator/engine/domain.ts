import { solveConicForY, type ExplicitBranch } from './conic-solver';
import { detectConic } from './conic-detector';
import { compileExpression, evaluate } from './evaluator';
import type { ExpressionNode } from './parser';

export interface DomainSplit {
  body: string;
  cond: string | null;
  error: string | null;
}

export interface CurveDomain {
  variable: 'x' | 'y' | 'theta' | 't';
  lo: number | null;
  hi: number | null;
  loStrict: boolean;
  hiStrict: boolean;
}

type AngleUnit = 'rad' | 'deg';

export function splitDomain(raw: string): DomainSplit {
  const open = raw.indexOf('{');
  const close = raw.indexOf('}');
  if (open < 0 && close < 0) return { body: raw, cond: null, error: null };
  const fail = (error: string): DomainSplit => ({ body: raw, cond: null, error });
  const opens = raw.split('{').length - 1;
  const closes = raw.split('}').length - 1;
  if (opens !== closes || close < open) return fail('Unbalanced braces in the domain');
  if (opens > 1) {
    return fail(
      raw.indexOf('{', open + 1) < close
        ? 'Nested braces are not allowed in a domain'
        : 'Only one domain {…} is allowed',
    );
  }
  if (raw.slice(close + 1).trim()) return fail('The domain {…} must come at the end');
  const body = raw.slice(0, open).trimEnd();
  const cond = raw.slice(open + 1, close).trim();
  if (!body.trim()) return fail('Write the curve before its domain');
  if (!cond) return fail('The domain {…} is empty');
  return { body, cond, error: null };
}

export function gateAst(cond: ExpressionNode, body: ExpressionNode): ExpressionNode {
  return { type: 'FunctionCallMultiArg', name: 'if', args: [cond, body] };
}

const NAMES: Record<CurveDomain['variable'], readonly string[]> = {
  x: ['x'],
  y: ['y'],
  t: ['t'],
  theta: ['t', 'x'],
};

const FLIP: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

type Bound = Pick<CurveDomain, 'lo' | 'hi' | 'loStrict' | 'hiStrict'>;

function constantValue(
  node: ExpressionNode,
  env: Record<string, number>,
  angleUnit: AngleUnit,
): number | null {
  try {
    const v = evaluate(node, env, angleUnit);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function oneBound(
  node: ExpressionNode,
  names: readonly string[],
  env: Record<string, number>,
  angleUnit: AngleUnit,
): Bound | null {
  if (node.type !== 'BinaryOp' || !FLIP[node.operator]) return null;
  const isVar = (n: ExpressionNode) => n.type === 'Variable' && names.includes(n.name);
  let op = node.operator;
  let other: ExpressionNode;
  if (isVar(node.left)) other = node.right;
  else if (isVar(node.right)) {
    other = node.left;
    op = FLIP[op];
  } else return null;
  const v = constantValue(other, env, angleUnit);
  if (v === null) return null;
  const strict = !op.includes('=');
  return op[0] === '>'
    ? { lo: v, loStrict: strict, hi: null, hiStrict: false }
    : { lo: null, loStrict: false, hi: v, hiStrict: strict };
}

/** Null unless the condition is `a <= x`, `x < b` or the chain `a <= x <= b` (`if(a<=x, x<=b, 0)`). */
export function domainBounds(
  condAst: ExpressionNode,
  variable: CurveDomain['variable'],
  env: Record<string, number> = {},
  angleUnit: AngleUnit = 'rad',
): CurveDomain | null {
  const names = NAMES[variable];
  const single = oneBound(condAst, names, env, angleUnit);
  if (single) return { variable, ...single };
  if (
    condAst.type !== 'FunctionCallMultiArg' ||
    condAst.name !== 'if' ||
    condAst.args.length !== 3 ||
    condAst.args[2].type !== 'NumberLiteral' ||
    condAst.args[2].value !== 0
  ) {
    return null;
  }
  const a = oneBound(condAst.args[0], names, env, angleUnit);
  const b = oneBound(condAst.args[1], names, env, angleUnit);
  if (!a || !b) return null;
  const lower = a.lo !== null ? a : b.lo !== null ? b : null;
  const upper = a.hi !== null ? a : b.hi !== null ? b : null;
  if (!lower || !upper || lower === upper) return null;
  return {
    variable,
    lo: lower.lo,
    loStrict: lower.loStrict,
    hi: upper.hi,
    hiStrict: upper.hiStrict,
  };
}

export function isEmptyDomain(d: CurveDomain): boolean {
  if (d.lo === null || d.hi === null) return false;
  return d.lo > d.hi || (d.lo === d.hi && (d.loStrict || d.hiStrict));
}

export function intersectDomains(
  domains: readonly (CurveDomain | null | undefined)[],
  variable: CurveDomain['variable'],
): { lo: number | null; hi: number | null } | null {
  const own = domains.filter((d): d is CurveDomain => !!d && d.variable === variable);
  if (!own.length) return null;
  const los = own.flatMap((d) => (d.lo === null ? [] : [d.lo]));
  const his = own.flatMap((d) => (d.hi === null ? [] : [d.hi]));
  return {
    lo: los.length ? Math.max(...los) : null,
    hi: his.length ? Math.min(...his) : null,
  };
}

export function insideDomain(v: number, d: CurveDomain, tol = 0): boolean {
  return (d.lo === null || v > d.lo + tol) && (d.hi === null || v < d.hi - tol);
}

export function atExcludedEdge(v: number, d: CurveDomain | null | undefined, tol: number): boolean {
  if (!d) return false;
  const near = (edge: number | null, strict: boolean) =>
    strict && edge !== null && Math.abs(v - edge) <= tol;
  return near(d.lo, d.loStrict) || near(d.hi, d.hiStrict);
}

const PROBE_OFFSETS = Array.from({ length: 241 }, (_, k) => 10 ** ((k - 120) / 30));

/** Live branches first (most samples inside the gate); null when the gate hides every branch. */
export function gatedConicBranches(
  body: ExpressionNode,
  gated: ExpressionNode,
): ExplicitBranch[] | null {
  const branches = solveConicForY(body);
  if (!branches || body === gated || gated.type !== 'BinaryOp') return branches;
  const gate = compileExpression(gated.left);
  const cx = detectConic(body)?.center?.x ?? 0;
  const probes = [cx, ...PROBE_OFFSETS.flatMap((s) => [cx - s, cx + s])];
  const live = branches
    .map((b) => {
      const fn = (x: number) => {
        const y = b.fn(x);
        return y === null || Number.isNaN(gate(x, y)) ? null : y;
      };
      return { branch: { ...b, fn }, hits: probes.filter((x) => fn(x) !== null).length };
    })
    .filter((b) => b.hits > 0)
    .sort((p, q) => q.hits - p.hits);
  return live.length ? live.map((b) => b.branch) : null;
}
