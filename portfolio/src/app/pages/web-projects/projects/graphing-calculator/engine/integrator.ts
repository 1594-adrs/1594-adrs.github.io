function evalSafe(f: (x: number) => number, x: number): number | null {
  try {
    const v = f(x);
    return isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function simpson(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number,
): { sum: number; skipped: number } {
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let sum = 0;
  let skipped = 0;

  const fa = evalSafe(f, a);
  const fb = evalSafe(f, b);
  sum = (fa ?? 0) + (fb ?? 0);
  if (fa === null) skipped++;
  if (fb === null) skipped++;

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const fx = evalSafe(f, x);
    if (fx === null) {
      skipped++;
      continue;
    }
    sum += (i % 2 === 0 ? 2 : 4) * fx;
  }

  return { sum: (h / 3) * sum, skipped };
}

export function integrate(f: (x: number) => number, a: number, b: number, n = 200): number {
  if (a === b) return 0;

  const r1 = simpson(f, a, b, n);
  const r2 = simpson(f, a, b, n * 2);

  if (r1.skipped > n * 0.3 || r2.skipped > n * 0.6) {
    const sign = r1.sum + r2.sum >= 0 ? 1 : -1;
    return sign * Number.POSITIVE_INFINITY;
  }

  if (!isFinite(r1.sum)) {
    return r1.sum > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  if (Math.abs(r1.sum) > 100) {
    const ratio = Math.abs(r2.sum / r1.sum);
    if (ratio > 1.8 || ratio < 0.5) {
      const sign = r2.sum >= 0 ? 1 : -1;
      return sign * Number.POSITIVE_INFINITY;
    }
  }

  return r1.sum;
}

export function computeIntegralPoints(
  f: (x: number) => number,
  a: number,
  b: number,
  steps = 200,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const h = (b - a) / steps;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    let y: number;
    try {
      y = f(x);
    } catch {
      y = NaN;
    }
    if (!isFinite(y)) y = NaN;
    points.push({ x, y });
  }
  return points;
}
