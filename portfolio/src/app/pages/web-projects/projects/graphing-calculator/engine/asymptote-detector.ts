import type { ExpressionNode } from './parser';

export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'oblique';
  equation: string;
  value: number;
  intercept?: number;
}

export type FunctionCategory =
  'rational' | 'trigonometric' | 'polynomial' | 'exponential' | 'logarithmic' | 'other';

const CACHE_LIMIT = 32;
const cache = new Map<string, Asymptote[]>();

// Object/function identity, not content, is the cache key component for the
// AST (or the plain function when no AST is given) — two structurally equal
// ASTs from different parses must not collide, and re-parses must not
// accidentally hit a stale entry.
let nextIdentityId = 0;
const identityIds = new WeakMap<object, number>();
function identityKey(obj: object): number {
  let id = identityIds.get(obj);
  if (id === undefined) {
    id = nextIdentityId++;
    identityIds.set(obj, id);
  }
  return id;
}

/** Rounds a viewport bound so nearby pans/zooms still hit the cache. */
function roundBound(v: number): number {
  if (!isFinite(v)) return v;
  const scale = Math.max(1, Math.abs(v));
  const precision = Math.pow(10, Math.floor(Math.log10(scale)) - 2);
  return Math.round(v / precision) * precision;
}

export function detectAsymptotes(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  ast?: ExpressionNode,
): Asymptote[] {
  const key = `${identityKey(ast ?? fn)}:${roundBound(xMin)}:${roundBound(xMax)}`;
  const cached = cache.get(key);
  if (cached) {
    // Refresh recency for the simple LRU eviction below.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const asymptotes: Asymptote[] = [];

  detectVertical(fn, xMin, xMax, asymptotes);

  if (canHaveHorizontalAsymptote(ast)) {
    detectHorizontal(fn, xMin, xMax, asymptotes);
  }

  if (canHaveObliqueAsymptote(ast)) {
    detectOblique(fn, xMin, xMax, asymptotes);
  }

  cache.set(key, asymptotes);
  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  return asymptotes;
}

/** Test-only: clears the memoization cache so specs don't leak state. */
export function clearAsymptoteCache(): void {
  cache.clear();
}

function categorizeFunction(ast?: ExpressionNode): FunctionCategory {
  if (!ast) return 'other';

  const trigFunctions = new Set([
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
  ]);

  const logExpFunctions = new Set(['log', 'ln', 'exp', 'logb']);

  function hasNodeType(node: ExpressionNode, types: string[]): boolean {
    if (types.includes(node.type)) return true;
    if (node.type === 'FunctionCall' || node.type === 'PoweredFunctionCall') {
      if (trigFunctions.has(node.name)) return true;
      if (logExpFunctions.has(node.name)) return true;
      return hasNodeType(node.arg, types);
    }
    if (node.type === 'FunctionCallMultiArg') {
      if (trigFunctions.has(node.name)) return true;
      if (logExpFunctions.has(node.name)) return true;
      return node.args.some((arg) => hasNodeType(arg, types));
    }
    if (node.type === 'BinaryOp') {
      return hasNodeType(node.left, types) || hasNodeType(node.right, types);
    }
    if (node.type === 'UnaryOp') {
      return hasNodeType(node.operand, types);
    }
    return false;
  }

  if (hasNodeType(ast, ['FunctionCall', 'FunctionCallMultiArg', 'PoweredFunctionCall'])) {
    const trigNames = [
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
    ];
    const logExpNames = ['log', 'ln', 'exp', 'logb'];
    const names = collectFunctionNames(ast);
    if (names.some((n) => trigNames.includes(n))) return 'trigonometric';
    if (names.some((n) => logExpNames.includes(n))) return 'exponential';
  }

  if (hasNodeType(ast, ['BinaryOp'])) {
    if (hasDivision(ast)) return 'rational';
  }

  if (isPolynomial(ast)) return 'polynomial';

  return 'other';
}

function collectFunctionNames(node: ExpressionNode): string[] {
  const names: string[] = [];
  function traverse(n: ExpressionNode) {
    if (
      n.type === 'FunctionCall' ||
      n.type === 'FunctionCallMultiArg' ||
      n.type === 'PoweredFunctionCall'
    ) {
      names.push(n.name);
      if (n.type === 'FunctionCall' || n.type === 'PoweredFunctionCall') traverse(n.arg);
      else if (n.type === 'FunctionCallMultiArg') n.args.forEach(traverse);
    } else if (n.type === 'BinaryOp') {
      traverse(n.left);
      traverse(n.right);
    } else if (n.type === 'UnaryOp') {
      traverse(n.operand);
    }
  }
  traverse(node);
  return names;
}

function hasDivision(node: ExpressionNode): boolean {
  if (node.type === 'BinaryOp' && node.operator === '/') return true;
  if (node.type === 'BinaryOp') return hasDivision(node.left) || hasDivision(node.right);
  if (node.type === 'UnaryOp') return hasDivision(node.operand);
  if (node.type === 'FunctionCall' || node.type === 'PoweredFunctionCall')
    return hasDivision(node.arg);
  if (node.type === 'FunctionCallMultiArg') return node.args.some(hasDivision);
  return false;
}

function isPolynomial(node: ExpressionNode): boolean {
  if (node.type === 'NumberLiteral' || node.type === 'Variable') return true;
  if (node.type === 'BinaryOp') {
    if (node.operator === '^') {
      if (
        node.left.type === 'Variable' &&
        node.right.type === 'NumberLiteral' &&
        Number.isInteger(node.right.value) &&
        node.right.value >= 0
      ) {
        return true;
      }
      return false;
    }
    if (['+', '-', '*'].includes(node.operator)) {
      return isPolynomial(node.left) && isPolynomial(node.right);
    }
    return false;
  }
  if (node.type === 'UnaryOp') return isPolynomial(node.operand);
  if (
    node.type === 'FunctionCall' ||
    node.type === 'FunctionCallMultiArg' ||
    node.type === 'PoweredFunctionCall'
  )
    return false;
  return false;
}

export function canHaveHorizontalAsymptote(ast?: ExpressionNode): boolean {
  const category = categorizeFunction(ast);
  return category === 'rational' || category === 'exponential' || category === 'logarithmic';
}

export function canHaveObliqueAsymptote(ast?: ExpressionNode): boolean {
  const category = categorizeFunction(ast);
  return category === 'rational';
}

function detectVertical(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  result: Asymptote[],
): void {
  const steps = 2000;
  const dx = (xMax - xMin) / steps;
  let prevY = safeEval(fn, xMin);

  for (let i = 1; i <= steps; i++) {
    const x = xMin + i * dx;
    const y = safeEval(fn, x);

    if ((prevY === null) !== (y === null)) {
      const left = prevY === null ? x : x - dx;
      const right = y === null ? x : x;
      const vx = binarySearchAsymptote(fn, left, right);
      if (vx !== null && vx > xMin && vx < xMax) {
        const eq = `x = ${fmtVal(vx)}`;
        if (!result.some((a) => Math.abs(a.value - vx) < 1e-6)) {
          result.push({ type: 'vertical', equation: eq, value: vx });
        }
      }
    } else if (
      prevY !== null &&
      y !== null &&
      Math.sign(prevY) !== Math.sign(y) &&
      Math.sign(prevY) !== 0 &&
      Math.sign(y) !== 0 &&
      (Math.abs(prevY) > 100 || Math.abs(y) > 100)
    ) {
      const vx = binarySearchAsymptote(fn, x - dx, x);
      if (vx !== null && vx > xMin && vx < xMax) {
        const eq = `x = ${fmtVal(vx)}`;
        if (!result.some((a) => Math.abs(a.value - vx) < 1e-6)) {
          result.push({ type: 'vertical', equation: eq, value: vx });
        }
      }
    }

    prevY = y;
  }
}

function binarySearchAsymptote(
  fn: (x: number) => number,
  left: number,
  right: number,
): number | null {
  for (let i = 0; i < 50; i++) {
    const mid = (left + right) / 2;
    const yMid = safeEval(fn, mid);
    if (yMid === null || !isFinite(yMid)) {
      right = mid;
      continue;
    }
    const yLeft = safeEval(fn, left);
    if (yLeft !== null && Math.abs(yLeft) > Math.abs(yMid)) {
      right = mid;
    } else {
      left = mid;
    }
  }
  const vx = (left + right) / 2;
  return isGenuineVerticalAsymptote(fn, vx) ? vx : null;
}

/**
 * Distinguishes a real vertical asymptote from a removable hole (e.g.
 * (x^2-1)/(x-1) at x=1, where `binarySearchAsymptote`'s bisection converges
 * exactly onto the 0/0 point and a single-point NaN/spike would otherwise be
 * mistaken for divergence). Samples both sides at several shrinking scales
 * and requires |f| to actually grow — not just be undefined or noisy at the
 * exact candidate point — as x approaches it.
 */
function isGenuineVerticalAsymptote(fn: (x: number) => number, vx: number): boolean {
  const base = Math.max(1e-3, Math.abs(vx) * 1e-3);
  const offsets = [base, base / 10, base / 100, base / 1000];

  for (const dir of [-1, 1] as const) {
    const vals: number[] = [];
    for (const off of offsets) {
      const y = safeEval(fn, vx + dir * off);
      if (y !== null) vals.push(Math.abs(y));
    }
    if (vals.length < 3) continue;

    let monotonic = true;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] < vals[i - 1] * 0.9) {
        monotonic = false;
        break;
      }
    }
    const growthRatio = vals[vals.length - 1] / Math.max(vals[0], 1e-300);
    if (monotonic && growthRatio > 1.5) return true;
  }
  return false;
}

interface ScaleSample {
  avg: number;
  values: number[];
}

/**
 * Analyzes one tail (x -> +Infinity when `dir` is 1, x -> -Infinity when -1)
 * across several widening scales and returns the limit `f` converges to,
 * or null when it doesn't converge to a horizontal asymptote. The tails are
 * analyzed separately (rather than pooling +x/-x samples into one average)
 * because pooling can average an unbounded odd-ish function like x+1/x down
 * to ~0 and look like a false "y = 0" horizontal.
 */
function analyzeHorizontalTail(
  fn: (x: number) => number,
  baseScale: number,
  scaleMultipliers: number[],
  samplesPerScale: number,
  dir: 1 | -1,
): number | null {
  const scaleSamples: ScaleSample[] = [];
  let directionChanges = 0;
  let signChanges = 0;
  let total = 0;

  for (const mult of scaleMultipliers) {
    const scale = baseScale * mult;
    const values: number[] = [];
    let prevY: number | null = null;
    let prevDirection = 0;

    for (let i = 0; i < samplesPerScale; i++) {
      const x = dir * scale * (0.05 + 0.9 * (i / (samplesPerScale - 1)));
      const y = safeEval(fn, x);
      if (y === null) continue;

      values.push(y);
      total++;

      if (prevY !== null) {
        if ((prevY > 0 && y < 0) || (prevY < 0 && y > 0)) signChanges++;
        const direction = y > prevY ? 1 : y < prevY ? -1 : 0;
        if (direction !== 0 && prevDirection !== 0 && direction !== prevDirection) {
          directionChanges++;
        }
        prevDirection = direction;
      }
      prevY = y;
    }

    if (values.length > 0) {
      scaleSamples.push({ avg: values.reduce((a, b) => a + b, 0) / values.length, values });
    }
  }

  if (total < 10 || scaleSamples.length < 3) return null;

  const directionChangeRatio = directionChanges / total;
  const signChangeRatio = signChanges / total;
  if (directionChangeRatio > 0.1 || signChangeRatio > 0.1) return null;

  const allValues = scaleSamples.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const valueRange = maxVal - minVal;

  if (valueRange > 0.5 && valueRange < 2.5) {
    const allBounded = allValues.every((v) => Math.abs(v) <= 1.5);
    if (allBounded && signChanges > 2) return null;
  }

  const first = scaleSamples[0];
  const prev = scaleSamples[scaleSamples.length - 2];
  const last = scaleSamples[scaleSamples.length - 1];
  const limit = last.avg;

  // Convergence trend, checked relative to the candidate limit's own
  // magnitude instead of a fixed absolute tolerance (a fixed 0.01 rejects a
  // real limit like y=2 whose approach error is naturally a few permille of
  // 2, and would separately accept a limit like y=1e8 from noise alone).
  const tolBase = Math.max(Math.abs(limit), 0.1);
  const lastSpread = Math.max(...last.values) - Math.min(...last.values);
  const drift = Math.abs(last.avg - prev.avg);
  const totalDrift = Math.abs(first.avg - last.avg);

  const converges =
    lastSpread < tolBase * 0.05 &&
    drift < tolBase * 0.02 &&
    (totalDrift < 1e-9 || drift <= totalDrift);

  return converges ? limit : null;
}

function detectHorizontal(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  result: Asymptote[],
): void {
  const baseScale = Math.max(Math.abs(xMin), Math.abs(xMax)) * 100;
  if (baseScale < 100) return;

  const scaleMultipliers = [0.25, 0.5, 0.75, 1, 2, 4];
  const samplesPerScale = 20;

  const limits = [
    analyzeHorizontalTail(fn, baseScale, scaleMultipliers, samplesPerScale, 1),
    analyzeHorizontalTail(fn, baseScale, scaleMultipliers, samplesPerScale, -1),
  ].filter((v): v is number => v !== null);

  for (const limit of limits) {
    if (!result.some((a) => a.type === 'horizontal' && Math.abs(a.value - limit) < 1e-6)) {
      const eq = `y = ${fmtVal(limit)}`;
      result.push({ type: 'horizontal', equation: eq, value: limit });
    }
  }
}

function detectOblique(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  result: Asymptote[],
): void {
  if (result.some((a) => a.type === 'horizontal')) return;

  const largeX = Math.max(Math.abs(xMin), Math.abs(xMax)) * 100;
  const y1 = safeEval(fn, largeX);
  const y2 = safeEval(fn, largeX * 0.5);

  if (y1 === null || y2 === null || !isFinite(y1) || !isFinite(y2)) return;

  const m = (y1 - y2) / (largeX - largeX * 0.5);
  const b = y1 - m * largeX;

  if (!isFinite(m) || !isFinite(b)) return;
  // A near-zero slope here is really a (missed) horizontal asymptote, not an
  // oblique one — never surface it as a spurious near-flat "oblique" line.
  if (Math.abs(m) < 1e-2) return;

  const yNeg = safeEval(fn, -largeX);
  if (yNeg !== null) {
    const mNeg = yNeg / -largeX;
    if (Math.abs(mNeg - m) > 0.1) return;
  }

  const residual = (x: number) => {
    const y = safeEval(fn, x);
    return y !== null ? Math.abs(y - (m * x + b)) : 0;
  };
  const avgResidual =
    (residual(largeX * 0.5) + residual(-largeX * 0.5) + residual(largeX * 0.25)) / 3;

  if (!(avgResidual < Math.abs(m * largeX * 0.01) + 1)) return;

  // Reject a candidate line that already fits the function almost exactly at
  // a moderate (non-asymptotic) distance — that's not an asymptote being
  // approached, it's the function itself (e.g. (x^2-1)/(x-1) === x+1 for all
  // x != 1: the "oblique" line isn't a limit, it's an exact, removable-hole
  // identity). A genuine oblique asymptote still has a real, shrinking-but
  // present residual well short of `largeX`.
  const scale = Math.max(Math.abs(xMin), Math.abs(xMax));
  const nearXCandidates = [0.2, 0.3, 0.5, 0.7]
    .map((f) => f * scale)
    .filter(
      (nx) => !result.some((a) => a.type === 'vertical' && Math.abs(a.value - nx) < 0.05 * scale),
    );
  const hasMeaningfulResidual = nearXCandidates.some(
    (nx) => residual(nx) > 1e-4 || residual(-nx) > 1e-4,
  );
  if (!hasMeaningfulResidual) return;

  const eq = `y = ${fmtVal(m)}x + ${fmtVal(b)}`;
  result.push({ type: 'oblique', equation: eq, value: m, intercept: b });
}

function safeEval(fn: (x: number) => number, x: number): number | null {
  try {
    const v = fn(x);
    return isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function fmtVal(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v));
  return v.toFixed(4);
}
