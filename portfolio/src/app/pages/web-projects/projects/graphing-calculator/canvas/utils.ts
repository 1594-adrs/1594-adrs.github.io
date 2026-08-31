// Canvas 2D context does not support CSS variables; these utilities are for canvas rendering only.

const CLAMP = 1e8;

export function tryEval(fn: (x: number) => number, x: number): number {
  try {
    const y = fn(x);
    if (!isFinite(y)) return NaN;
    if (y > CLAMP) return CLAMP;
    if (y < -CLAMP) return -CLAMP;
    return y;
  } catch {
    return NaN;
  }
}

export function findAxisCrossings(
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  steps = 500,
): number[] {
  const h = (b - a) / steps;
  const crossings: number[] = [];
  const EPS = 1e-12;
  let prevDiff = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    let y: number;
    try {
      y = fn(x);
    } catch {
      prevDiff = NaN;
      continue;
    }
    if (!isFinite(y)) {
      prevDiff = NaN;
      continue;
    }
    const diff = y - k;
    if (Math.abs(diff) < EPS) {
      crossings.push(x);
      prevDiff = diff;
      continue;
    }
    if (isFinite(prevDiff) && Math.abs(prevDiff) >= EPS && prevDiff * diff < 0) {
      const t = prevDiff / (prevDiff - diff);
      crossings.push(a + (i - 1) * h + t * h);
    }
    prevDiff = diff;
  }
  return crossings;
}
