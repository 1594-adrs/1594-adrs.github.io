import type { ExpressionNode } from './parser';

export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'oblique';
  equation: string;
  value: number;
  intercept?: number;
}

export type FunctionCategory =
  'rational' | 'trigonometric' | 'polynomial' | 'exponential' | 'logarithmic' | 'other';

export function detectAsymptotes(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  ast?: ExpressionNode,
): Asymptote[] {
  const asymptotes: Asymptote[] = [];

  detectVertical(fn, xMin, xMax, asymptotes);

  if (canHaveHorizontalAsymptote(ast)) {
    detectHorizontal(fn, xMin, xMax, asymptotes);
  }

  if (canHaveObliqueAsymptote(ast)) {
    detectOblique(fn, xMin, xMax, asymptotes);
  }

  return asymptotes;
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
  const result = (left + right) / 2;
  const yResult = safeEval(fn, result);
  if (yResult !== null && isFinite(yResult) && Math.abs(yResult) < 1000) {
    return null;
  }
  return result;
}

function detectHorizontal(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  result: Asymptote[],
): void {
  const baseScale = Math.max(Math.abs(xMin), Math.abs(xMax)) * 100;
  if (baseScale < 100) return;

  const scales = [baseScale * 0.25, baseScale * 0.5, baseScale * 0.75, baseScale, baseScale * 2];
  const samplesPerScale = 20;

  const allValues: number[] = [];
  let directionChanges = 0;
  let signChanges = 0;

  for (const scale of scales) {
    let prevY: number | null = null;
    let prevDirection = 0;

    for (let i = 0; i < samplesPerScale; i++) {
      const x = scale * (0.05 + 0.9 * (i / (samplesPerScale - 1)));
      const y = safeEval(fn, x);
      if (y === null) continue;

      allValues.push(y);

      if (prevY !== null) {
        if ((prevY > 0 && y < 0) || (prevY < 0 && y > 0)) {
          signChanges++;
        }
        const direction = y > prevY ? 1 : y < prevY ? -1 : 0;
        if (direction !== 0 && prevDirection !== 0 && direction !== prevDirection) {
          directionChanges++;
        }
        prevDirection = direction;
      }
      prevY = y;
    }

    prevY = null;
    prevDirection = 0;

    for (let i = 0; i < samplesPerScale; i++) {
      const x = -scale * (0.05 + 0.9 * (i / (samplesPerScale - 1)));
      const y = safeEval(fn, x);
      if (y === null) continue;

      allValues.push(y);

      if (prevY !== null) {
        if ((prevY > 0 && y < 0) || (prevY < 0 && y > 0)) {
          signChanges++;
        }
        const direction = y > prevY ? 1 : y < prevY ? -1 : 0;
        if (direction !== 0 && prevDirection !== 0 && direction !== prevDirection) {
          directionChanges++;
        }
        prevDirection = direction;
      }
      prevY = y;
    }
  }

  if (allValues.length < 20) return;

  const totalSamples = allValues.length;
  const directionChangeRatio = directionChanges / totalSamples;
  const signChangeRatio = signChanges / totalSamples;

  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const valueRange = maxVal - minVal;

  if (directionChangeRatio > 0.1 || signChangeRatio > 0.1) {
    return;
  }

  if (valueRange > 0.5 && valueRange < 2.5) {
    const allBounded = allValues.every((v) => Math.abs(v) <= 1.5);
    if (allBounded && signChanges > 2) {
      return;
    }
  }

  const avg = allValues.reduce((a, b) => a + b, 0) / totalSamples;
  const maxDev = Math.max(...allValues.map((v) => Math.abs(v - avg)));

  if (maxDev < 0.01 && Math.abs(avg) < 1e6) {
    const eq = `y = ${fmtVal(avg)}`;
    if (!result.some((a) => a.type === 'horizontal' && Math.abs(a.value - avg) < 1e-6)) {
      result.push({ type: 'horizontal', equation: eq, value: avg });
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

  if (Math.abs(m) > 1e-6 && avgResidual < Math.abs(m * largeX * 0.01) + 1) {
    const eq = `y = ${fmtVal(m)}x + ${fmtVal(b)}`;
    result.push({ type: 'oblique', equation: eq, value: m, intercept: b });
  }
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
