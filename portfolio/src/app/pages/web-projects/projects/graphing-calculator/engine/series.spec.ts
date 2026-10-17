import { describe, it, expect } from 'vitest';
import { recurrence, sequenceLimit, seriesSum, type Term } from './series';
import { compileExpression } from './evaluator';
import { parse } from './parser';
import type { LimitResult } from './limit';

/** aₙ from an expression in x (= n). */
const term = (expr: string): Term => {
  const g = compileExpression(parse(expr));
  return (n) => g(n, NaN);
};
const seq = (expr: string, nStart = 1) => sequenceLimit(term(expr), nStart);
const sum = (expr: string, nStart = 1) => seriesSum(term(expr), nStart);

const expectFinite = (r: LimitResult, value: number, rel = 1e-6) => {
  expect(r.status).toBe('finite');
  expect(Math.abs(r.value - value)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(value)));
};
const expectStatus = (r: LimitResult, status: 'dne' | 'unknown') => {
  expect(r.status).toBe(status);
  expect(r.value).toBeNaN();
};

describe('sequenceLimit', () => {
  it.each([
    ['1/x', 0],
    ['(1+1/x)^x', Math.E],
    ['(sqrt(x)+1)/(sqrt(x)+3)', 1],
    ['(-1)^x/x', 0], // parities agree
    ['10^x/factorial(x)', 0], // NaN past n = 170: the packed range still decides
    ['2^x*factorial(x)^2/factorial(2*x+1)', 0], // rate settles at ln 2
    ['x^41/19^x', 0], // underflowed zeros, then NaN
  ])('%s → %s', (expr, value) => expectFinite(seq(expr), value));

  it.each([
    ['x^2', Infinity],
    ['ln(1/3^x)', -Infinity], // −n·ln 3, then ln 0 = −∞: polynomial rate
    ['3^x/x^3', Infinity],
    ['factorial(x)/6^x', Infinity],
    ['3*(4/3)^(x-1)', Infinity],
  ])('%s → %s', (expr, value) => {
    const r = seq(expr);
    expect(r.status).toBe('infinite');
    expect(r.value).toBe(value);
  });

  it.each(['(-1)^x', 'cos(x)', '(-1)^x*x', '(-1)^(x+1)*(sqrt(x)+1)/(sqrt(x)+3)'])(
    '%s oscillates → dne',
    (expr) => expectStatus(seq(expr), 'dne'),
  );

  it.each([
    ['1000^x/factorial(x)', 'grows until it overflows, but its rate falls toward a turn'],
    ['ln(x)^200/x', 'overflows near 1e15, long before its peak at e^200'],
    ['ln(x)/x^0.01', 'rises over n ≤ 4e15 (peak e^100), falling by 1e300'],
    ['ln(x)^30/x', 'rises until e^30, a long growth run among the samples'],
    ['ln(x)^10/x^0.5', 'past its peak the fall is too slow for computeLimit'],
    ['sin(x)/ln(x)', 'envelope 1/ln n shrinks: not an oscillation that persists'],
    ['sin(x)/x^0.1', 'envelope shrinks'],
    ['x^200/2^x', 'x²⁰⁰ overflows at n = 35, before the peak at n ≈ 289'],
    ['x^100/1.01^x', 'polynomial-looking rate on a range shorter than 100 × the degree'],
    ['exp(sqrt(x))/x^100', 'x¹⁰⁰ overflows to 0 terms long before e^√n wins'],
    ['exp(x)/x^300', 'zeros from x³⁰⁰ overflow, NaN once eˣ overflows'],
  ])('%s → unknown (%s)', (expr) => expectStatus(seq(expr), 'unknown'));

  it.each(['cos(x)/x^3', 'sin(2*x)/x^3'])('%s → 0: parities 0 and 4e-35 are no jump', (expr) =>
    expectFinite(seq(expr), 0),
  );

  it.each([
    ['2^(2^x)', 'overflows at n = 10: too few samples for computeLimit'],
    ['exp(x^2)', 'overflows at n = 27'],
  ])('%s → ∞ (%s)', (expr) => {
    const r = seq(expr);
    expect(r.status).toBe('infinite');
    expect(r.value).toBe(Infinity);
  });

  it('squaring recurrence a(n+1) = a(n)², a(1) = 2 → ∞', () => {
    const r = sequenceLimit(
      recurrence([2], 1, 1, (_, [w]) => w * w),
      1,
    );
    expect(r.status).toBe('infinite');
    expect(r.value).toBe(Infinity);
  });

  it.each(['sin(x)', '1e-20*(-1)^x', '(-1)^x*(1+1/x)', '2+sin(x)'])(
    '%s keeps oscillating to the last terms → dne',
    (expr) => expectStatus(seq(expr), 'dne'),
  );

  it('reads recurrences: a(n+1) = √(2 + a(n)) → 2', () => {
    const a = recurrence([0], 1, 1, (_, [w]) => Math.sqrt(2 + w));
    expectFinite(sequenceLimit(a, 1), 2);
  });

  it('a term that always throws decides nothing', () => {
    const r = sequenceLimit(() => {
      throw new Error('boom');
    }, 1);
    expect(r.status).not.toBe('finite');
    expect(r.status).not.toBe('infinite');
  });
});

describe('seriesSum', () => {
  it('slow p-series: Σ1/n² = π²/6 to 1e-8', () => {
    expectFinite(sum('1/x^2'), Math.PI ** 2 / 6, 1e-8);
  });

  it('alternating: Σ(-1)ⁿ/n = −ln 2', () => {
    expectFinite(sum('(-1)^x/x'), -Math.LN2);
  });

  it('power series near the radius: Σ0.9ⁿ = 10', () => {
    expectFinite(sum('0.9^x', 0), 10, 1e-10);
  });

  it('an overflow-NaN tail does not spoil a converged sum: Σ10ⁿ/n! = e¹⁰', () => {
    expectFinite(sum('10^x/factorial(x)', 0), Math.exp(10), 1e-12);
  });

  it('sin π as a series: a sum of ~0 with small rounding is finite', () => {
    expectFinite(sum('(-1)^x*pi^(2*x+1)/factorial(2*x+1)', 0), 0);
  });

  it('recurrence terms: a(0) = 1, a(n+1) = a(n)/2 sums to 2', () => {
    const a = recurrence([1], 0, 1, (_, [w]) => w / 2);
    expectFinite(seriesSum(a, 0), 2, 1e-12);
  });

  it('a term that throws past a geometric tail is ignored', () => {
    const a: Term = (n) => {
      if (n > 300) throw new Error('overflow');
      return 0.5 ** n;
    };
    expectFinite(seriesSum(a, 0), 2, 1e-12);
  });

  it.each([
    ['1/x', 1, Infinity], // harmonic: n·aₙ → 1
    ['1/sqrt(x)', 1, Infinity],
    ['-1/x', 1, -Infinity],
    ['1/(x*ln(x))', 2, Infinity], // n·ln n·aₙ → 1
    ['1.03^x', 0, Infinity], // past the radius: terms grow
    ['ln(1/3^x)', 1, -Infinity],
    ['1+1/x', 1, Infinity], // terms → 1
    ['1/root(3,x^2)', 1, Infinity], // n·aₙ = n^(1/3): its far samples hit 0 when n² overflows
    ['sqrt(x)-sqrt(x+1)', 1, -Infinity], // far n·aₙ is 0 by cancellation, not a turn
  ])('Σ %s (n ≥ %s) → %s', (expr, nStart, value) => {
    const r = sum(expr, nStart);
    expect(r.status).toBe('infinite');
    expect(r.value).toBe(value);
  });

  it.each(['(-1)^x', '(-1)^x*1.03^x', '(-1)^(x+1)*(sqrt(x)+1)/(sqrt(x)+3)'])('Σ %s → dne', (expr) =>
    expectStatus(sum(expr, 0), 'dne'),
  );

  it('undefined at the start → dne', () => {
    expectStatus(sum('1/x', 0), 'dne');
  });

  it.each([
    ['factorial(x)/1000^x', 0, 'shrinks until n = 1000, then diverges'],
    ['(-40)^x/factorial(x)', 0, 'cancels terms of 1e16 down to e^-40: rounding too large'],
    ['(-100)^x/factorial(x)', 1, 'catastrophic cancellation'],
    ['(x+2^x)/(x^2*2^x)', 1, 'n²·2ⁿ overflows (terms 0, then NaN) before the 1/n² tail settles'],
  ])('Σ %s → unknown (%s)', (expr, nStart) => expectStatus(sum(expr, nStart), 'unknown'));

  // Convergent, but beyond what sampling decides today: 'unknown' (or a finite sum), never ∞/dne.
  it.each([
    ['1/x^1.01', 1, 'n·ln n·aₙ = ln n/n^0.01 rises over the integer samples'],
    ['ln(x)/x^1.1', 2, 'comparator rises until e^100'],
    ['ln(x)^4/x^1.5', 2, 'comparator rises until e^10, falls slowly'],
    ['0.9999^x', 0, 'partial sums still growing after MAX_TERMS'],
    ['-0.9999^x', 0, 'partial sums still growing after MAX_TERMS'],
    ['cos(x)/x^3', 1, 'partial sums oscillate as they settle'],
    ['sin(x)/ln(x)', 2, 'terms → 0 too slowly to show'],
    ['sin(x)/x^0.1', 2, 'terms → 0 too slowly to show'],
  ])('Σ %s converges: finite or unknown (%s)', (expr, nStart) =>
    expect(['finite', 'unknown']).toContain(sum(expr, nStart).status),
  );

  it('Σsin(2n)/n³ = (2π²·2 − 3π·4 + 8)/12', () => {
    expectFinite(sum('sin(2*x)/x^3'), (4 * Math.PI ** 2 - 12 * Math.PI + 8) / 12, 1e-8);
  });
});
