import { describe, it, expect } from 'vitest';
import { compileExpression } from './evaluator';
import { parse } from './parser';
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

describe('integrateAdaptive with infinite bounds', () => {
  const I = Infinity;
  const sinc = (x: number) => (x === 0 ? 1 : Math.sin(x) / x);

  it.each<[string, (x: number) => number, number, number, number]>([
    ['1/x^2 on [1, inf)', (x) => 1 / x ** 2, 1, I, 1],
    ['e^-x on [0, inf)', (x) => Math.exp(-x), 0, I, 1],
    ['1/(1+x^2) on (-inf, inf)', (x) => 1 / (1 + x * x), -I, I, Math.PI],
    ['x e^-x^2 on [0, inf)', (x) => x * Math.exp(-x * x), 0, I, 0.5],
    ['x e^-x^2 on (-inf, inf)', (x) => x * Math.exp(-x * x), -I, I, 0],
    ['x e^x on (-inf, 0]', (x) => x * Math.exp(x), -I, 0, -1],
    ['x^-1.001 on [1, inf) (tail added analytically)', (x) => x ** -1.001, 1, I, 1000],
    [
      '1/((1+x) sqrt x) on [0, inf) (singular endpoint too)',
      (x) => 1 / ((1 + x) * Math.sqrt(x)),
      0,
      I,
      Math.PI,
    ],
    ['e^-x cos x on [0, inf)', (x) => Math.exp(-x) * Math.cos(x), 0, I, 0.5],
    ['sin(x)/x on [0, inf) (conditionally convergent)', sinc, 0, I, Math.PI / 2],
    ['sin(x)/x on (-inf, inf)', sinc, -I, I, Math.PI],
    ['sin(x)/sqrt(x) on [0, inf)', (x) => Math.sin(x) / Math.sqrt(x), 0, I, Math.sqrt(Math.PI / 2)],
  ])('%s converges', (_, f, a, b, want) => {
    const r = integrateAdaptive(f, a, b);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, want)).toBeLessThanOrEqual(1e-7);
  });

  it.each<[string, (x: number) => number, number, number]>([
    ['1/x on [1, inf)', (x) => 1 / x, 1, I],
    ['1/(x ln x) on [2, inf)', (x) => 1 / (x * Math.log(x)), 2, I],
    ['x^-0.9 on [1, inf)', (x) => x ** -0.9, 1, I],
    ['x/(1+x^2) on (-inf, inf) (no principal value)', (x) => x / (1 + x * x), -I, I],
    ['sin x on [0, inf) (oscillates without settling)', Math.sin, 0, I],
    ['sin(x)(1 + 1/x) on [1, inf)', (x) => Math.sin(x) * (1 + 1 / x), 1, I],
  ])('%s diverges at infinity', (_, f, a, b) => {
    const r = integrateAdaptive(f, a, b);
    expect(r.status).toBe('divergent');
    expect(Math.abs(r.badPoint!)).toBe(Infinity);
  });

  it('reports a pole inside an infinite interval at the pole', () => {
    const r = integrateAdaptive(Math.tan, 0, I);
    expect(r.status).toBe('divergent');
    expect(r.badPoint).toBeCloseTo(Math.PI / 2, 8);
  });

  it('negates reversed infinite bounds', () => {
    const r = integrateAdaptive((x) => Math.exp(-x), I, 0);
    expect(r.status).toBe('ok');
    expect(relErr(r.value, -1)).toBeLessThanOrEqual(1e-9);
  });

  it('never calls an unresolvably fast oscillation ok: sin(1000x)/x', () => {
    expect(integrateAdaptive((x) => Math.sin(1000 * x) / x, 1, I).status).toBe('inaccurate');
  });
});

describe('integrateAdaptive: piecewise if()', () => {
  const fn = (src: string) => {
    const c = compileExpression(parse(src));
    return (x: number) => c(x, NaN);
  };

  it.each<[string, number, number, number]>([
    ['if(x < 0, -1, 1)', -1, 1, 0],
    ['if(x < 0, -1, 1)', -1, 2, 1],
    ['if(x < 1/3, x^2, 5 - x)', 0, 1, 1 / 81 + (5 * 2) / 3 - (1 - 1 / 9) / 2],
    ['if(x < 0, -x, x)', -1, 2, 2.5],
  ])('∫ %s on [%d, %d] = %d', (src, a, b, want) => {
    const r = integrateAdaptive(fn(src), a, b);
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(want, 7);
  });
});
