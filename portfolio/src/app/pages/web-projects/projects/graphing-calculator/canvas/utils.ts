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
