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
const HUGE_MAGNITUDE = 1e6;
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
  } else if (spec.curves.length > 2) {
    issues.push({
      code: 'too-many-curves',
      severity: 'error',
      message: 'At most 2 curves are supported.',
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

    let runStart = -1;
    let undefinedAt: number | null = null;
    let divergentAt: number | null = null;

    for (let i = 0; i < SAMPLE_COUNT && (undefinedAt === null || divergentAt === null); i++) {
      const v = values[i];
      const t = i === SAMPLE_COUNT - 1 ? b : a + i * dt;

      if (divergentAt === null && (v === Infinity || v === -Infinity)) {
        divergentAt = t;
      } else if (divergentAt === null && Number.isFinite(v) && Math.abs(v) > HUGE_MAGNITUDE) {
        divergentAt = t;
      }

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

    if (divergentAt !== null) {
      issues.push({
        code: 'divergent',
        severity: 'error',
        message: `${label} diverges near ${spec.variable} ≈ ${divergentAt.toFixed(4)}`,
        at: divergentAt,
      });
    } else if (undefinedAt !== null) {
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

  if (spec.axis && (spec.method === 'disk-washer' || spec.method === 'shell')) {
    const axisValue = spec.axis.value;
    let axisInside = false;

    if (spec.method === 'shell') {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      axisInside = axisValue > lo + endpointEps && axisValue < hi - endpointEps;
    } else {
      for (let i = 0; i < SAMPLE_COUNT && !axisInside; i++) {
        const vals = samplesByCurve.map((s) => s[i]).filter((v) => Number.isFinite(v));
        if (vals.length === 0) continue;
        const lower = spec.curves.length >= 2 ? Math.min(...vals) : Math.min(vals[0], axisValue);
        const upper = spec.curves.length >= 2 ? Math.max(...vals) : Math.max(vals[0], axisValue);
        if (axisValue > lower + 1e-9 && axisValue < upper - 1e-9) {
          axisInside = true;
        }
      }
    }

    if (axisInside) {
      issues.push({
        code: 'axis-inside-region',
        severity: 'warning',
        message: 'The axis passes through the region — the solid may overlap itself.',
        field: 'axis',
      });
    }
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
