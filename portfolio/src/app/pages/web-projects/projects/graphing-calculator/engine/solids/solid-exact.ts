/**
 * Recognises a computed volume (or surface area) as a short closed form,
 * trying (in this order, and preferring the smallest denominator, then the
 * fewest radicals): a plain rational p/q, then (p/q)·π, (p/q)·√2, (p/q)·√3,
 * (p/q)·π·√2, (p/q)·π·√3 and (p/q)·π·(1+√2), for q up to 60. An integer
 * volume (e.g. 16) is reported as the plain rational '16' - it's still an
 * exact closed form, just one without a fractional or irrational part.
 */

const MAX_DENOMINATOR = 60;
const REL_TOL = 1e-9;

interface Form {
  multiplier: number;
  /** '' for the plain-rational form. */
  unit: string;
}

const FORMS: Form[] = [
  { multiplier: 1, unit: '' },
  { multiplier: Math.PI, unit: 'π' },
  { multiplier: Math.SQRT2, unit: '√2' },
  { multiplier: Math.sqrt(3), unit: '√3' },
  { multiplier: Math.PI * Math.SQRT2, unit: 'π√2' },
  { multiplier: Math.PI * Math.sqrt(3), unit: 'π√3' },
  // Cheap addition for cone-like lateral-surface totals, e.g. π(1+√2).
  { multiplier: Math.PI * (1 + Math.SQRT2), unit: 'π(1+√2)' },
];

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function format(p: number, q: number, unit: string): string {
  const negative = p < 0;
  const absP = Math.abs(p);
  const numerator = unit === '' ? String(absP) : absP === 1 ? unit : `${absP}${unit}`;
  const body = q === 1 ? numerator : `${numerator}/${q}`;
  return negative ? `-${body}` : body;
}

export function recognizeExact(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) < 1e-12) return '0';

  const tol = REL_TOL * Math.max(1, Math.abs(value));

  for (let q = 1; q <= MAX_DENOMINATOR; q++) {
    for (const form of FORMS) {
      const scaled = (value / form.multiplier) * q;
      const p = Math.round(scaled);
      if (p === 0) continue;
      // Only accept already-reduced fractions: a reducible p/q would have
      // matched at its smaller, reduced q first.
      if (gcd(Math.abs(p), q) !== 1) continue;

      const candidate = (p / q) * form.multiplier;
      if (Math.abs(value - candidate) <= tol) {
        return format(p, q, form.unit);
      }
    }
  }

  return null;
}
