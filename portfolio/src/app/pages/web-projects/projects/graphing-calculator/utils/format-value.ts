/** Formats a numeric result for display: "undefined" for NaN, "inf"/"-inf" for infinities,
 *  "0" for values below the display epsilon, and exponential notation outside a friendly range. */
export function formatValue(v: number): string {
  if (Number.isNaN(v)) return 'undefined';
  if (v === Number.POSITIVE_INFINITY) return 'inf';
  if (v === Number.NEGATIVE_INFINITY) return '-inf';
  if (Math.abs(v) < 1e-10) return '0';
  if (Math.abs(v) >= 1e12) return v.toExponential(3);
  if (Math.abs(v) < 0.001) return v.toExponential(3);
  return v.toFixed(6);
}
