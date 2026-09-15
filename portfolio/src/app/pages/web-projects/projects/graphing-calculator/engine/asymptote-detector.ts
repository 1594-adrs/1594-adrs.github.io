export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'oblique';
  equation: string;
  value: number;
  intercept?: number;
}

export function detectAsymptotes(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
): Asymptote[] {
  const asymptotes: Asymptote[] = [];

  detectVertical(fn, xMin, xMax, asymptotes);
  detectHorizontal(fn, xMin, xMax, asymptotes);
  detectOblique(fn, xMin, xMax, asymptotes);

  return asymptotes;
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
