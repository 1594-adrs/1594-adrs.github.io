import { describe, it, expect } from 'vitest';
import { validateSolidSpec, curveModeMatchesVariable } from './solid-validation';
import type { SolidCurve, SolidSpec } from './solid.types';

function curve(fn: (t: number) => number, label = 'f₁'): SolidCurve {
  return { fn, ast: null, label, color: '#fff' };
}

function spec(overrides: Partial<SolidSpec>): SolidSpec {
  return {
    method: 'disk-washer',
    variable: 'x',
    curves: [curve((x) => Math.sin(x))],
    a: 0,
    b: Math.PI,
    axis: { orientation: 'horizontal', value: 0 },
    ...overrides,
  };
}

describe('validateSolidSpec', () => {
  it('valid disk-washer spec has no issues', () => {
    expect(validateSolidSpec(spec({}))).toEqual([]);
  });

  it('valid shell spec has no issues', () => {
    const s = spec({
      method: 'shell',
      variable: 'x',
      axis: { orientation: 'vertical', value: 0 },
      curves: [curve((x) => x * x)],
      a: 1,
      b: 2,
    });
    expect(validateSolidSpec(s)).toEqual([]);
  });

  it('valid cross-section spec has no issues', () => {
    const s = spec({ method: 'cross-section', axis: undefined, shape: 'square', a: 0, b: 1 });
    expect(validateSolidSpec(s)).toEqual([]);
  });

  it('flags no-curves', () => {
    const s = spec({ curves: [] });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'no-curves', severity: 'error', field: 'curves' }),
    ]);
  });

  it('accepts up to 5 curves (no too-many-curves error)', () => {
    const s = spec({
      curves: [
        curve((x) => x),
        curve((x) => x + 1),
        curve((x) => x + 2),
        curve((x) => x + 3),
        curve((x) => x + 4),
      ],
    });
    const issues = validateSolidSpec(s);
    expect(issues.some((i) => i.severity === 'error')).toBe(false);
  });

  it('flags too-many-curves beyond 5', () => {
    const s = spec({
      curves: [
        curve((x) => x),
        curve((x) => x + 1),
        curve((x) => x + 2),
        curve((x) => x + 3),
        curve((x) => x + 4),
        curve((x) => x + 5),
      ],
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'too-many-curves', severity: 'error', field: 'curves' }),
    ]);
  });

  it('flags interior-curve when a curve never bounds the region', () => {
    // f2 = 1 (constant) sits strictly between f1 = 2 and f3 = 0 everywhere on [0,1].
    const s = spec({
      method: 'cross-section',
      shape: 'square',
      axis: undefined,
      curves: [curve(() => 2, 'f₁'), curve(() => 1, 'f₂'), curve(() => 0, 'f₃')],
      a: 0,
      b: 1,
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'interior-curve',
        severity: 'info',
        field: 'curves',
        message: 'f₂ lies inside the region and does not bound the solid',
      }),
    ]);
  });

  it('does not flag interior-curve when every curve bounds the region somewhere', () => {
    // f1 = x, f2 = 1 - x and f3 = 0.3 each take a turn as the envelope's upper or
    // lower boundary on some sub-interval of (0,1), so none is always interior.
    const s = spec({
      method: 'disk-washer',
      curves: [curve((x) => x, 'f₁'), curve((x) => 1 - x, 'f₂'), curve(() => 0.3, 'f₃')],
      a: 0,
      b: 1,
    });
    const issues = validateSolidSpec(s);
    expect(issues.some((i) => i.code === 'interior-curve')).toBe(false);
  });

  it('flags bounds-order when a >= b (a > b)', () => {
    const issues = validateSolidSpec(spec({ a: 2, b: 1 }));
    expect(issues).toEqual([
      expect.objectContaining({ code: 'bounds-order', severity: 'error', field: 'a' }),
    ]);
  });

  it('flags bounds-order when a === b', () => {
    const issues = validateSolidSpec(spec({ a: 1, b: 1 }));
    expect(issues).toEqual([
      expect.objectContaining({ code: 'bounds-order', severity: 'error', field: 'a' }),
    ]);
  });

  it('flags bounds-nan', () => {
    const issues = validateSolidSpec(spec({ a: NaN }));
    expect(issues).toEqual([
      expect.objectContaining({ code: 'bounds-nan', severity: 'error', field: 'a' }),
    ]);
  });

  it('flags missing-axis for disk-washer', () => {
    const issues = validateSolidSpec(spec({ axis: undefined }));
    expect(issues).toEqual([
      expect.objectContaining({ code: 'missing-axis', severity: 'error', field: 'axis' }),
    ]);
  });

  it('flags axis-orientation for disk-washer with variable x and a vertical axis', () => {
    const s = spec({
      method: 'disk-washer',
      variable: 'x',
      axis: { orientation: 'vertical', value: 0 },
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'axis-orientation',
        severity: 'error',
        field: 'axis',
        message: 'For a vertical axis with y = f(x), use the shell method.',
      }),
    ]);
  });

  it('flags missing-shape for cross-section', () => {
    const s = spec({ method: 'cross-section', axis: undefined });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'missing-shape', severity: 'error', field: 'shape' }),
    ]);
  });

  it('flags bad-ratio for a rectangle with heightRatio <= 0', () => {
    const s = spec({
      method: 'cross-section',
      axis: undefined,
      shape: 'rectangle',
      heightRatio: 0,
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'bad-ratio', severity: 'error', field: 'ratio' }),
    ]);
  });

  it('detects undefined-domain for sqrt(x) on [-1, 1] near x ≈ -1', () => {
    const s = spec({
      method: 'cross-section',
      shape: 'square',
      axis: undefined,
      curves: [curve((x) => Math.sqrt(x))],
      a: -1,
      b: 1,
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'undefined-domain', severity: 'error' }),
    ]);
    expect(issues[0].at).toBeCloseTo(-1, 5);
  });

  it('leaves poles to the quadrature (1/x and ln x pass validation)', () => {
    const base = { method: 'cross-section' as const, shape: 'square' as const, axis: undefined };
    expect(
      validateSolidSpec(spec({ ...base, curves: [curve((x) => 1 / x)], a: -1, b: 1 })),
    ).toEqual([]);
    expect(validateSolidSpec(spec({ ...base, curves: [curve(Math.log)], a: 0, b: 1 }))).toEqual([]);
  });

  it('detects curves-cross for x and x^2 on [0, 2] at x ≈ 1', () => {
    const s = spec({
      method: 'cross-section',
      shape: 'square',
      axis: undefined,
      curves: [curve((x) => x, 'f₁'), curve((x) => x * x, 'f₂')],
      a: 0,
      b: 2,
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([expect.objectContaining({ code: 'curves-cross', severity: 'info' })]);
    expect(issues[0].at).toBeCloseTo(1, 5);
    expect(issues[0].message).toContain('1');
  });

  it('detects axis-inside-region for shell with y=x^2 on [0,1] about x=0.5', () => {
    const s = spec({
      method: 'shell',
      variable: 'x',
      axis: { orientation: 'vertical', value: 0.5 },
      curves: [curve((x) => x * x)],
      a: 0,
      b: 1,
    });
    const issues = validateSolidSpec(s);
    expect(issues).toEqual([
      expect.objectContaining({ code: 'axis-inside-region', severity: 'warning', field: 'axis' }),
    ]);
  });

  it('flags axis-orientation for disk-washer with variable x and vertical axis (contract table)', () => {
    const s = spec({
      method: 'disk-washer',
      variable: 'x',
      axis: { orientation: 'vertical', value: 1 },
      curves: [curve((x) => x)],
      a: 0,
      b: 1,
    });
    const issues = validateSolidSpec(s);
    expect(issues.some((i) => i.code === 'axis-orientation')).toBe(true);
  });
});

describe('curveModeMatchesVariable', () => {
  it('matches explicit with x', () => {
    expect(curveModeMatchesVariable('explicit', 'x')).toBe(true);
  });

  it('matches explicit-y with y', () => {
    expect(curveModeMatchesVariable('explicit-y', 'y')).toBe(true);
  });

  it('rejects explicit with y', () => {
    expect(curveModeMatchesVariable('explicit', 'y')).toBe(false);
  });

  it('rejects explicit-y with x', () => {
    expect(curveModeMatchesVariable('explicit-y', 'x')).toBe(false);
  });

  it('rejects implicit/parametric/polar entirely', () => {
    expect(curveModeMatchesVariable('implicit', 'x')).toBe(false);
    expect(curveModeMatchesVariable('parametric', 'x')).toBe(false);
    expect(curveModeMatchesVariable('polar', 'y')).toBe(false);
  });
});
