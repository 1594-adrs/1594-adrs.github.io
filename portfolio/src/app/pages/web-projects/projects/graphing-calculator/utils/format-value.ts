/** Single number formatter for every result in the calculator: "undefined" for NaN, "∞"/"-∞"
 *  for infinities, "0" below the display epsilon, exponential outside a friendly range, and
 *  otherwise up to 6 decimals with trailing zeros trimmed ("2", "1.5", "3.141593"). */
export function formatValue(v: number): string {
  if (Number.isNaN(v)) return 'undefined';
  if (v === Number.POSITIVE_INFINITY) return '∞';
  if (v === Number.NEGATIVE_INFINITY) return '-∞';
  if (Math.abs(v) < 1e-10) return '0';
  if (Math.abs(v) >= 1e12 || Math.abs(v) < 0.001) return v.toExponential(3);
  return v
    .toFixed(6)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}
