/**
 * Area swept by polar curves. Pure math: no DOM/Angular.
 *
 * One curve: the textbook ½∫_a^b r² dt (a loop traced twice counts twice, as in the book).
 * Two curves: the region is read geometrically, by the distance Rᵢ(φ) of each curve from the
 * pole in every direction φ (from the parameters t ∈ [a, b] that point there, r < 0 included):
 * - one curve inside the other in every direction → between them: ½∫(R_out² − R_in²) dφ;
 * - otherwise → the common interior (the lens): ½∫ min(R₁, R₂)² dφ.
 * A curve that reaches a direction at two different distances (an inner loop) has no single
 * R(φ): status 'unsupported' rather than a guess.
 */
import { bisectSignChange } from './numeric-utils';
import { integrateAdaptive, type QuadratureStatus } from './quadrature';

type Fn1 = (t: number) => number;

export interface PolarAreaResult {
  value: number;
  status: QuadratureStatus | 'unsupported';
  /** Two curves: how the region was read. */
  region?: 'between' | 'common';
  badPoint?: number;
}

const TAU = 2 * Math.PI;
const GRID = 2000;

function safe(r: Fn1, t: number): number {
  try {
    return r(t);
  } catch {
    return NaN;
  }
}

const wrap = (t: number) => ((t % TAU) + TAU) % TAU;

/** A crossing strictly inside (lo, hi): a zero run (R₁ = R₂ = 0 outside the bounds) is not one,
 * and thousands of breakpoints there starve the quadrature's evaluation budget. */
function strictSignChange(g: Fn1, lo: number, hi: number): number | null {
  const [p, q] = [g(lo), g(hi)];
  return p * q < 0 ? bisectSignChange(g, lo, hi) : null;
}

/**
 * Distance of the curve from the pole in direction φ, over t ∈ [a, b]; 0 when no t points
 * there; NaN when two parameters disagree (not star-shaped from the pole).
 */
function radiusFn(r: Fn1, a: number, b: number): Fn1 {
  const slack = 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
  return (phi) => {
    let R: number | undefined;
    for (const [base, sign] of [
      [phi, 1],
      [phi + Math.PI, -1],
    ]) {
      for (let k = Math.ceil((a - slack - base) / TAU); base + k * TAU <= b + slack; k++) {
        const v = safe(r, Math.min(b, Math.max(a, base + k * TAU)));
        if (Number.isNaN(v) || sign * v < 0 || (sign < 0 && v === 0)) continue;
        const d = Math.abs(v);
        if (R === undefined) R = d;
        else if (Math.abs(R - d) > 1e-7 * Math.max(1, R, d)) return NaN;
      }
    }
    return R ?? 0;
  };
}

export function polarArea(curves: Fn1[], a: number, b: number): PolarAreaResult {
  if (curves.length === 1) {
    const res = integrateAdaptive((t) => safe(curves[0], t) ** 2 / 2, a, b);
    return { value: res.value, status: res.status, badPoint: res.badPoint };
  }
  // shortcut: 3+ curves would need a region picker; the dataset has at most two.
  if (curves.length !== 2 || !(b > a)) return { value: NaN, status: 'unsupported' };

  const [R1, R2] = curves.map((r) => radiusFn(r, a, b));
  const phis = Array.from({ length: GRID + 1 }, (_, i) => (TAU * i) / GRID);
  const d = phis.map((p) => R1(p) - R2(p));
  if (d.some(Number.isNaN)) return { value: NaN, status: 'unsupported' };

  // Kinks and jumps of R: where parameters start/stop pointing, where r changes sign, R₁ = R₂.
  const breaks = [a, b, a + Math.PI, b + Math.PI].map(wrap);
  const ts = Array.from({ length: GRID + 1 }, (_, i) => a + ((b - a) * i) / GRID);
  for (const r of curves) {
    const g = (t: number) => safe(r, t);
    for (let i = 0; i < GRID; i++) {
      const z = strictSignChange(g, ts[i], ts[i + 1]);
      if (z !== null) breaks.push(wrap(z), wrap(z + Math.PI));
    }
  }
  const diff = (p: number) => R1(p) - R2(p);
  for (let i = 0; i < GRID; i++) {
    const z = strictSignChange(diff, phis[i], phis[i + 1]);
    if (z !== null) breaks.push(z);
  }

  const scale = Math.max(...phis.map((p) => Math.max(R1(p), R2(p))), 1e-300);
  const eps = 1e-9 * scale;
  const outer = d.every((v) => v >= -eps) ? 1 : d.every((v) => v <= eps) ? 2 : 0;
  let starShaped = true;
  const integrand = (p: number): number => {
    const [u, v] = [R1(p), R2(p)];
    if (Number.isNaN(u) || Number.isNaN(v)) starShaped = false;
    if (outer === 1) return (u * u - v * v) / 2;
    if (outer === 2) return (v * v - u * u) / 2;
    return Math.min(u, v) ** 2 / 2;
  };
  const res = integrateAdaptive(integrand, 0, TAU, { breakpoints: breaks });
  if (!starShaped) return { value: NaN, status: 'unsupported' };
  return {
    value: res.value,
    status: res.status,
    region: outer ? 'between' : 'common',
    badPoint: res.badPoint,
  };
}
