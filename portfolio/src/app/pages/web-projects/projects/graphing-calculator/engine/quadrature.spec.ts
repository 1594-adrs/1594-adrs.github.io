import { describe, it, expect } from 'vitest';
import { integrateAdaptive } from './quadrature';

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
}

describe('integrateAdaptive', () => {
  it('computes ∫0^1 x^2 = 1/3', () => {
    const r = integrateAdaptive((x) => x * x, 0, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 1 / 3)).toBeLessThanOrEqual(1e-8);
  });

  it('computes ∫0^π sin(x) = 2', () => {
    const r = integrateAdaptive(Math.sin, 0, Math.PI);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 2)).toBeLessThanOrEqual(1e-8);
  });

  it('computes ∫0^1 sqrt(x) = 2/3', () => {
    const r = integrateAdaptive(Math.sqrt, 0, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 2 / 3)).toBeLessThanOrEqual(1e-8);
  });

  it('computes ∫0^1 1/sqrt(x) = 2 (endpoint singularity)', () => {
    const r = integrateAdaptive((x) => 1 / Math.sqrt(x), 0, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 2)).toBeLessThanOrEqual(1e-6);
  });

  it('computes ∫0^1 ln(x) = -1 (endpoint singularity)', () => {
    const r = integrateAdaptive(Math.log, 0, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, -1)).toBeLessThanOrEqual(1e-6);
  });

  it('computes ∫0^1 ln(x)^2 = 2 (endpoint singularity)', () => {
    const r = integrateAdaptive((x) => Math.log(x) ** 2, 0, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 2)).toBeLessThanOrEqual(1e-6);
  });

  it('computes ∫1^e 1/x = 1', () => {
    const r = integrateAdaptive((x) => 1 / x, 1, Math.E);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 1)).toBeLessThanOrEqual(1e-8);
  });

  it('computes ∫-1^1 sqrt(1-x^2) = π/2 (semicircle area)', () => {
    const r = integrateAdaptive((x) => Math.sqrt(1 - x * x), -1, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, Math.PI / 2)).toBeLessThanOrEqual(1e-7);
  });

  it('computes ∫0^1e6 1/(1+x^2) ≈ π/2 - 1e-6 without false convergence', () => {
    const r = integrateAdaptive((x) => 1 / (1 + x * x), 0, 1e6);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, Math.PI / 2 - 1e-6)).toBeLessThanOrEqual(1e-5);
  });

  it('computes ∫0^5 floor(x) = 10 (jump discontinuities)', () => {
    const r = integrateAdaptive(Math.floor, 0, 5);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 10)).toBeLessThanOrEqual(1e-4);
  });

  it('detects ∫-1^1 1/x as divergent', () => {
    const r = integrateAdaptive((x) => 1 / x, -1, 1);
    expect(r.status).toBe('divergent');
    expect(r.badPoint).toBeCloseTo(0, 1);
  });

  it('detects ∫0^1 1/x as divergent', () => {
    const r = integrateAdaptive((x) => 1 / x, 0, 1);
    expect(r.status).toBe('divergent');
  });

  it('detects ∫-1^1 1/x^2 as divergent', () => {
    const r = integrateAdaptive((x) => 1 / (x * x), -1, 1);
    expect(r.status).toBe('divergent');
  });

  it('detects ∫-1^1 sqrt(x) as undefined (out of domain on half the interval)', () => {
    const r = integrateAdaptive(Math.sqrt, -1, 1);
    expect(r.status).toBe('undefined');
    expect(r.badPoint).toBeLessThan(0);
  });

  it('negates the result for reversed bounds', () => {
    const forward = integrateAdaptive((x) => x * x, 0, 1);
    const reversed = integrateAdaptive((x) => x * x, 1, 0);
    expect(reversed.value).toBeCloseTo(-forward.value, 8);
    expect(reversed.status).toBe('ok');
  });

  it('returns 0 for equal bounds', () => {
    const r = integrateAdaptive((x) => x * x, 3, 3);
    expect(r).toEqual({ value: 0, error: 0, status: 'ok' });
  });

  it('honors explicit breakpoints', () => {
    const r = integrateAdaptive(Math.floor, 0, 5, { breakpoints: [1, 2, 3, 4] });
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 10)).toBeLessThanOrEqual(1e-4);
  });

  it('completes 200 calls of sin(x)*exp(-x) over [0, 10] quickly', () => {
    const f = (x: number) => Math.sin(x) * Math.exp(-x);
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      integrateAdaptive(f, 0, 10);
    }
    const elapsedMs = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(
      `integrateAdaptive: 200 calls of sin(x)*exp(-x) over [0,10] took ${elapsedMs.toFixed(2)}ms`,
    );
    expect(elapsedMs).toBeLessThan(3000);
  });
});

describe('integrateAdaptive wave-1 (H5, H6)', () => {
  it('1/(1+x^2) on [-1e5, 1e5] converges to atan-based value, status ok (was false divergent)', () => {
    const r = integrateAdaptive((x) => 1 / (1 + x * x), -1e5, 1e5);
    expect(r.status).toBe('ok');
    expect(Math.abs(r.value - 2 * Math.atan(1e5))).toBeLessThan(1e-6);
    expect(Math.abs(r.value - Math.PI)).toBeLessThan(1e-4);
  });

  it('1/(1+x^2) on [-1e3, 1e3] and [0, 1e6]', () => {
    const a = integrateAdaptive((x) => 1 / (1 + x * x), -1e3, 1e3);
    expect(a.status).toBe('ok');
    expect(a.value).toBeCloseTo(2 * Math.atan(1e3), 8);
    const b = integrateAdaptive((x) => 1 / (1 + x * x), 0, 1e6);
    expect(b.status).toBe('ok');
    expect(b.value).toBeCloseTo(Math.atan(1e6), 7);
  });

  it('tan(x) on [0, 3] crosses the pole at pi/2: not ok', () => {
    const r = integrateAdaptive(Math.tan, 0, 3);
    expect(r.status).not.toBe('ok');
    expect(r.status).toBe('divergent');
    expect(r.badPoint).toBeCloseTo(Math.PI / 2, 3);
  });

  it('1/x on [-1, 1] is divergent at 0', () => {
    const r = integrateAdaptive((x) => 1 / x, -1, 1);
    expect(r.status).toBe('divergent');
  });

  it('ordinary endpoint singularities stay ok: int_0^1 x^-0.5 = 2, ln(x) = -1', () => {
    const a = integrateAdaptive((x) => Math.pow(x, -0.5), 0, 1);
    expect(a.status).toBe('ok');
    expect(a.value).toBeCloseTo(2, 4);
    const b = integrateAdaptive(Math.log, 0, 1);
    expect(b.status).toBe('ok');
    expect(b.value).toBeCloseTo(-1, 5);
  });

  it("reports 'inaccurate' (not 'ok') when the error estimate stays above tolerance", () => {
    // a wildly oscillating integrand that the evaluation budget cannot resolve
    const r = integrateAdaptive((x) => Math.sin(1 / (x + 1e-9) ** 2), 0, 1, { maxEvals: 600 });
    expect(r.status).toBe('inaccurate');
    expect(Number.isFinite(r.value)).toBe(true);
    expect(r.error).toBeGreaterThan(0);
  });

  it('smooth integrands remain ok and tight', () => {
    const r = integrateAdaptive(Math.sin, 0, Math.PI);
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(2, 12);
  });
});

describe('integrateAdaptive power-law singularities (local exponent test)', () => {
  const cbrt2 = (x: number) => Math.cbrt(x) ** 2;

  it.each([
    ['x^-0.5', (x: number) => Math.pow(x, -0.5), 2],
    ['x^-0.95', (x: number) => Math.pow(x, -0.95), 20],
    ['x^-0.99', (x: number) => Math.pow(x, -0.99), 100],
    ['x^-0.999', (x: number) => 1 / Math.pow(x, 0.999), 1000],
  ])('integrable endpoint singularity ∫0^1 %s is ok and accurate', (_name, f, expected) => {
    const r = integrateAdaptive(f, 0, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, expected)).toBeLessThanOrEqual(1e-6);
  });

  it('interior singularity on a mesh boundary: ∫-1^1 x^(-2/3) = 6', () => {
    const r = integrateAdaptive((x) => 1 / cbrt2(x), -1, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 6)).toBeLessThanOrEqual(1e-6);
  });

  it('interior singularity: ∫0^2 (x-1)^(-2/3) = 6', () => {
    const r = integrateAdaptive((x) => 1 / cbrt2(x - 1), 0, 2);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 6)).toBeLessThanOrEqual(1e-6);
  });

  it('interior singularity off the mesh: ∫-1^1 |x-0.3|^(-1/2)', () => {
    const r = integrateAdaptive((x) => 1 / Math.sqrt(Math.abs(x - 0.3)), -1, 1);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 2 * (Math.sqrt(1.3) + Math.sqrt(0.7)))).toBeLessThanOrEqual(1e-6);
  });

  it('odd integrable singularity: ∫-1^2 sign(x)|x|^(-1/2) = 2√2 - 2', () => {
    const r = integrateAdaptive((x) => Math.sign(x) / Math.sqrt(Math.abs(x)), -1, 2);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, 2 * Math.SQRT2 - 2)).toBeLessThanOrEqual(1e-6);
  });

  it.each([
    ['x·sec(x)^2 over [1, 2] (even pole at π/2)', (x: number) => x / Math.cos(x) ** 2, 1, 2],
    [
      'sec(x)tan(x) over [1, 2] (even pole at π/2)',
      (x: number) => Math.sin(x) / Math.cos(x) ** 2,
      1,
      2,
    ],
    [
      '1/|x - 0.3| over [-1, 1] (even pole off the mesh, p = 1)',
      (x: number) => 1 / Math.abs(x - 0.3),
      -1,
      1,
    ],
    ['1/(x-1)^2 over [0, 2]', (x: number) => 1 / (x - 1) ** 2, 0, 2],
    ['1/x over [0, 1]', (x: number) => 1 / x, 0, 1],
    ['1/x over [-1, 1]', (x: number) => 1 / x, -1, 1],
    ['x^-1.01 over [0, 1]', (x: number) => Math.pow(x, -1.01), 0, 1],
  ])('non-integrable pole: %s is divergent', (_name, f, a, b) => {
    const r = integrateAdaptive(f, a, b);
    expect(r.status).toBe('divergent');
  });

  it('locates the even pole of x·sec(x)^2 at π/2', () => {
    const r = integrateAdaptive((x) => x / Math.cos(x) ** 2, 1, 2);
    expect(r.badPoint).toBeCloseTo(Math.PI / 2, 8);
    expect(r.value).toBeGreaterThan(0);
  });

  it('p within the documented margin of 1 counts as divergent: x^-(1 - 1e-7)', () => {
    const r = integrateAdaptive((x) => Math.pow(x, -(1 - 1e-7)), 0, 1);
    expect(r.status).toBe('divergent');
  });

  it('log-type singularities keep their previous verdicts', () => {
    expect(integrateAdaptive((x) => 1 / (x * Math.log(x)), 0, 0.5).status).toBe('divergent');
    const ln = integrateAdaptive(Math.log, 0, 1);
    expect(ln.status).toBe('ok');
    expect(relErr(ln.value, -1)).toBeLessThanOrEqual(1e-6);
  });
});
