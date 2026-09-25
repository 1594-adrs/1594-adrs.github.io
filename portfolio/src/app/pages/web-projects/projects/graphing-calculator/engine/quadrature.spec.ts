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
