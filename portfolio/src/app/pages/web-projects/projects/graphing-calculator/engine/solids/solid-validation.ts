import type {
  AxisLine,
  IntegrationVariable,
  SolidIssue,
  SolidMethod,
  SolidSpec,
} from './solid.types';
import type { DetectedCurveMode } from '../mode-detector';

const SAMPLE_COUNT = 401;
const MIN_UNDEFINED_RUN = 2;
const ENDPOINT_EPS_FRACTION = 1e-6;

function methodLabel(method: SolidMethod): string {
  return method === 'disk-washer' ? 'disk/washer' : method === 'shell' ? 'shell' : 'cross-section';
}

function curveVariableLabel(variable: IntegrationVariable): string {
  return variable === 'x' ? 'y = f(x)' : 'x = g(y)';
}

/** The method that correctly pairs with this variable + axis orientation, per the contract's table. */
function correctMethodFor(
  variable: IntegrationVariable,
  orientation: AxisLine['orientation'],
): SolidMethod {
  if (variable === 'x') return orientation === 'horizontal' ? 'disk-washer' : 'shell';
  return orientation === 'vertical' ? 'disk-washer' : 'shell';
}

function axisOrientationOk(
  method: SolidMethod,
  variable: IntegrationVariable,
  orientation: AxisLine['orientation'],
): boolean {
  return correctMethodFor(variable, orientation) === method;
}

function sampleCurve(fn: (t: number) => number, a: number, b: number, n: number): number[] {
  const values: number[] = new Array(n);
  const dt = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) {
    const t = i === n - 1 ? b : a + i * dt;
    try {
      values[i] = fn(t);
    } catch {
      values[i] = NaN;
    }
  }
  return values;
}

type ShellSide = 'both' | 'left' | 'right' | 'partial';

/**
 * How a shell spec whose axis lies strictly inside (a, b) revolves its two sides onto each other:
 * at distance r from the axis the region occupies the y-interval of t = k - r and the one of
 * t = k + r. The solid is their union, but the shell sum 2*pi*|t - k|*(U - L) counts both, so:
 * - null: the sides never overlap (e.g. one above and one below the x-axis); the plain sum is right.
 * - intervals: for every r one side's interval contains the other's (always true for one curve),
 *   so revolving only the returned t-intervals of [a, b] gives the union, e.g. 3+2x-x^2 on [-1, 3]
 *   about x = 1 keeps [1, 3]. Ties keep the right side.
 * - 'partial': the intervals overlap without nesting (two or more curves); no shell formula
 *   describes the union, so computeSolid rejects it instead of returning a volume that is too large.
 */
export function shellAxisSplit(spec: SolidSpec): Array<[number, number]> | 'partial' | null {
  if (spec.method !== 'shell' || !spec.axis || spec.curves.length === 0) return null;
  const k = spec.axis.value;
  const rMax = Math.min(k - spec.a, spec.b - k);
  if (!(rMax > 0)) return null;

  const interval = (t: number): [number, number] | null => {
    let lo = spec.curves.length === 1 ? 0 : Infinity;
    let hi = spec.curves.length === 1 ? 0 : -Infinity;
    let any = spec.curves.length === 1;
    for (const curve of spec.curves) {
      let v: number;
      try {
        v = curve.fn(t);
      } catch {
        continue;
      }
      if (!Number.isFinite(v)) continue;
      any = true;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return any ? [lo, hi] : null;
  };

  const side = (r: number): ShellSide => {
    const left = interval(k - r);
    const right = interval(k + r);
    if (!left || !right) return 'both';
    const scale = Math.max(1, Math.abs(left[1] - left[0]), Math.abs(right[1] - right[0]));
    const tol = 1e-9 * scale;
    // Containment first: a side that shrinks to a point on the other's edge is still nested.
    if (right[0] <= left[0] + tol && right[1] >= left[1] - tol) return 'right';
    if (left[0] <= right[0] + tol && left[1] >= right[1] - tol) return 'left';
    if (Math.min(left[1], right[1]) - Math.max(left[0], right[0]) <= tol) return 'both';
    return 'partial';
  };

  // sides[i] is the side at r = rMax * (i + 1) / SAMPLE_COUNT.
  const sides: ShellSide[] = [];
  for (let i = 1; i <= SAMPLE_COUNT; i++) {
    const s = side((rMax * i) / SAMPLE_COUNT);
    if (s === 'partial') return 'partial';
    sides.push(s);
  }
  if (sides.every((s) => s === 'both')) return null;

  const kept: Array<[number, number]> = [];
  const keep = (s: ShellSide, r0: number, r1: number) => {
    if (s !== 'left') kept.push([k + r0, k + r1]);
    if (s !== 'right') kept.push([k - r1, k - r0]);
  };
  let start = 0;
  for (let i = 1; i < sides.length; i++) {
    if (sides[i] === sides[i - 1]) continue;
    // Bisect the switch so the formula bounds are exact enough for recognizeExact.
    let lo = (rMax * i) / SAMPLE_COUNT;
    let hi = (rMax * (i + 1)) / SAMPLE_COUNT;
    for (let j = 0; j < 60; j++) {
      const mid = 0.5 * (lo + hi);
      if (side(mid) === sides[i - 1]) lo = mid;
      else hi = mid;
    }
    keep(sides[i - 1], start, lo);
    start = lo;
  }
  keep(sides[sides.length - 1], start, rMax);
  // Beyond rMax only the longer side exists.
  if (spec.a < k - rMax) kept.push([spec.a, k - rMax]);
  if (spec.b > k + rMax) kept.push([k + rMax, spec.b]);

  kept.sort((p, q) => p[0] - q[0]);
  const merged: Array<[number, number]> = [];
  for (const [lo, hi] of kept) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return merged;
}

export const SHELL_AXIS_OVERLAP_MESSAGE =
  'The axis passes through the region and the two sides partly overlap when revolved, so no shell formula describes the solid. Use the disk/washer method or move the axis outside the interval.';

/**
 * Whether the axis of revolution cuts the region: strictly inside (a, b) for shell, strictly
 * between the lower and upper boundary at some sample for disk-washer. `samplesByCurve` (SAMPLE_COUNT
 * uniform samples per curve) is computed when not given.
 */
export function axisInsideRegion(spec: SolidSpec, samplesByCurve?: number[][]): boolean {
  if (!spec.axis || (spec.method !== 'disk-washer' && spec.method !== 'shell')) return false;
  const { a, b } = spec;
  const axisValue = spec.axis.value;

  if (spec.method === 'shell') {
    const endpointEps = Math.max(1e-9, (b - a) * ENDPOINT_EPS_FRACTION);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return axisValue > lo + endpointEps && axisValue < hi - endpointEps;
  }

  const samples = samplesByCurve ?? spec.curves.map((c) => sampleCurve(c.fn, a, b, SAMPLE_COUNT));
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const vals = samples.map((s) => s[i]).filter((v) => Number.isFinite(v));
    if (vals.length === 0) continue;
    const lower = spec.curves.length >= 2 ? Math.min(...vals) : Math.min(vals[0], axisValue);
    const upper = spec.curves.length >= 2 ? Math.max(...vals) : Math.max(vals[0], axisValue);
    if (axisValue > lower + 1e-9 && axisValue < upper - 1e-9) return true;
  }
  return false;
}

/**
 * Validates a solid-of-revolution / cross-section spec, producing English,
 * user-facing issues. Static (structural) checks run first; sampling-based
 * checks (domain, divergence, crossings, axis placement) only run when there
 * are no static errors, since they need a coherent [a, b] and curve set.
 */
export function validateSolidSpec(spec: SolidSpec): SolidIssue[] {
  const issues: SolidIssue[] = [];

  if (spec.curves.length === 0) {
    issues.push({
      code: 'no-curves',
      severity: 'error',
      message: 'Select at least one curve for the solid.',
      field: 'curves',
    });
  } else if (spec.curves.length > 5) {
    issues.push({
      code: 'too-many-curves',
      severity: 'error',
      message: 'At most 5 curves are supported.',
      field: 'curves',
    });
  }

  const aIsNaN = Number.isNaN(spec.a);
  const bIsNaN = Number.isNaN(spec.b);
  if (aIsNaN || bIsNaN) {
    issues.push({
      code: 'bounds-nan',
      severity: 'error',
      message: 'Bounds a and b must be numbers.',
      field: aIsNaN ? 'a' : 'b',
    });
  } else if (spec.a >= spec.b) {
    issues.push({
      code: 'bounds-order',
      severity: 'error',
      message: 'The lower bound a must be less than the upper bound b.',
      field: 'a',
    });
  }

  if (spec.method === 'disk-washer' || spec.method === 'shell') {
    if (!spec.axis) {
      issues.push({
        code: 'missing-axis',
        severity: 'error',
        message: 'An axis of revolution is required.',
        field: 'axis',
      });
    } else if (!axisOrientationOk(spec.method, spec.variable, spec.axis.orientation)) {
      const suggestion = correctMethodFor(spec.variable, spec.axis.orientation);
      const axisWord =
        spec.axis.orientation === 'vertical' ? 'a vertical axis' : 'a horizontal axis';
      issues.push({
        code: 'axis-orientation',
        severity: 'error',
        message: `For ${axisWord} with ${curveVariableLabel(spec.variable)}, use the ${methodLabel(suggestion)} method.`,
        field: 'axis',
      });
    }
  } else if (spec.method === 'cross-section') {
    if (!spec.shape) {
      issues.push({
        code: 'missing-shape',
        severity: 'error',
        message: 'Select a cross-section shape.',
        field: 'shape',
      });
    }
    if (spec.shape === 'rectangle' && !(spec.heightRatio !== undefined && spec.heightRatio > 0)) {
      issues.push({
        code: 'bad-ratio',
        severity: 'error',
        message: 'The rectangle height ratio must be greater than 0.',
        field: 'ratio',
      });
    }
  }

  const hasStaticErrors = issues.some((i) => i.severity === 'error');
  if (hasStaticErrors) return issues;

  const a = spec.a;
  const b = spec.b;
  const dt = (b - a) / (SAMPLE_COUNT - 1);
  const endpointEps = Math.max(1e-9, (b - a) * ENDPOINT_EPS_FRACTION);
  const samplesByCurve = spec.curves.map((c) => sampleCurve(c.fn, a, b, SAMPLE_COUNT));

  for (let c = 0; c < spec.curves.length; c++) {
    const values = samplesByCurve[c];
    const label = spec.curves[c].label;

    // Infinite samples are not reported here: a pole does not imply a divergent volume
    // (e.g. ln x on [0, 1] gives 2π). computeSolid's quadrature decides and reports 'divergent'.
    let runStart = -1;
    let undefinedAt: number | null = null;

    for (let i = 0; i < SAMPLE_COUNT && undefinedAt === null; i++) {
      const v = values[i];

      if (Number.isNaN(v)) {
        if (runStart === -1) runStart = i;
      } else {
        if (undefinedAt === null && runStart !== -1 && i - runStart >= MIN_UNDEFINED_RUN) {
          const badT = i === SAMPLE_COUNT - 1 ? b : a + runStart * dt;
          undefinedAt = badT;
        }
        runStart = -1;
      }
    }
    if (undefinedAt === null && runStart !== -1 && SAMPLE_COUNT - runStart >= MIN_UNDEFINED_RUN) {
      undefinedAt = a + runStart * dt;
    }

    if (undefinedAt !== null) {
      issues.push({
        code: 'undefined-domain',
        severity: 'error',
        message: `${label} is undefined near ${spec.variable} ≈ ${undefinedAt.toFixed(4)}`,
        at: undefinedAt,
      });
    }
  }

  if (spec.curves.length === 2) {
    const [v0, v1] = samplesByCurve;
    const crossings: number[] = [];
    let prevDiff = NaN;
    let prevT = NaN;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i === SAMPLE_COUNT - 1 ? b : a + i * dt;
      const y0 = v0[i];
      const y1 = v1[i];
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) {
        prevDiff = NaN;
        prevT = NaN;
        continue;
      }
      const diff = y0 - y1;
      if (diff === 0) {
        if (t > a + endpointEps && t < b - endpointEps) crossings.push(t);
      } else if (Number.isFinite(prevDiff) && prevDiff !== 0 && prevDiff * diff < 0) {
        const frac = prevDiff / (prevDiff - diff);
        const rootT = prevT + frac * (t - prevT);
        if (rootT > a + endpointEps && rootT < b - endpointEps) {
          crossings.push(rootT);
        }
      }
      prevDiff = diff;
      prevT = t;
    }
    if (crossings.length > 0) {
      const shown = crossings.slice(0, 3).map((x) => x.toFixed(4).replace(/\.?0+$/, ''));
      issues.push({
        code: 'curves-cross',
        severity: 'info',
        message: `Curves cross at ${spec.variable} ≈ ${shown.join(', ')} — the region is split there`,
        at: crossings[0],
      });
    }
  }

  if (spec.curves.length >= 3) {
    for (let c = 0; c < spec.curves.length; c++) {
      let interiorEverywhere = true;
      let sawValidSample = false;
      for (let i = 0; i < SAMPLE_COUNT && interiorEverywhere; i++) {
        // Curves selected together commonly meet exactly at a or b (e.g. x, x², x³ all pass
        // through the origin) - that coincidence doesn't mean the curve suddenly bounds the
        // region there, so it shouldn't disqualify it from being "always interior".
        const t = i === SAMPLE_COUNT - 1 ? b : a + i * dt;
        if (t < a + endpointEps || t > b - endpointEps) continue;
        const vc = samplesByCurve[c][i];
        if (!Number.isFinite(vc)) continue;
        const others = samplesByCurve
          .filter((_, idx) => idx !== c)
          .map((s) => s[i])
          .filter((v) => Number.isFinite(v));
        if (others.length === 0) continue;
        sawValidSample = true;
        const maxOther = Math.max(...others);
        const minOther = Math.min(...others);
        // Interior means some other curve is strictly above vc AND some
        // other is strictly below it - i.e. vc is neither the overall max
        // nor the overall min, so it never forms the region's boundary.
        if (!(vc < maxOther - 1e-9 && vc > minOther + 1e-9)) {
          interiorEverywhere = false;
        }
      }
      if (sawValidSample && interiorEverywhere) {
        issues.push({
          code: 'interior-curve',
          severity: 'info',
          message: `${spec.curves[c].label} lies inside the region and does not bound the solid`,
          field: 'curves',
        });
      }
    }
  }

  if (axisInsideRegion(spec, samplesByCurve)) {
    // Shell + partly overlapping sides cannot be computed correctly (see shellAxisSplit): block it.
    const blocking = spec.method === 'shell' && shellAxisSplit(spec) === 'partial';
    issues.push({
      code: 'axis-inside-region',
      severity: blocking ? 'error' : 'warning',
      message: blocking
        ? SHELL_AXIS_OVERLAP_MESSAGE
        : 'The axis passes through the region — the solid may overlap itself.',
      field: 'axis',
    });
  }

  return issues;
}

/** 'explicit' curves are functions of x, 'explicit-y' curves are functions of y. */
export function curveModeMatchesVariable(
  mode: DetectedCurveMode,
  variable: IntegrationVariable,
): boolean {
  return (mode === 'explicit' && variable === 'x') || (mode === 'explicit-y' && variable === 'y');
}
