import type { QuadratureResult, QuadratureStatus } from '../engine/quadrature';
import type { ConicInfo } from '../engine/conic-detector';
import { formatValue } from './format-value';

/** A result row for the footer: label, value text, an optional approximation marker and
 *  optional notes (rendered in a `role="status"` region). */
export interface ResultRow {
  label: string;
  value: string;
  /** Prefix shown before the value when it is only approximate ("≈"). */
  approx?: boolean;
  /** Error estimate text ("± 1.2e-9"), only for meaningful (> 1e-9) errors. */
  error?: string;
  notes?: string[];
}

/** Value text for a quadrature outcome that is not a plain finite number. */
export function statusValueText(
  status: QuadratureStatus,
  value: number,
  badPoint?: number,
): string {
  if (status === 'divergent') return 'divergent';
  if (status === 'undefined') {
    return badPoint !== undefined ? `undefined near x ≈ ${formatValue(badPoint)}` : 'undefined';
  }
  return formatValue(value);
}

/** Describes the signed integral of f from a to b, with limits in the label, error estimate and
 *  warnings for reversed / empty / divergent / inaccurate cases. Optionally adds the total
 *  (unsigned) area row. */
export function describeIntegral(
  expr: string,
  a: number,
  b: number,
  r: QuadratureResult,
  absArea?: number,
): ResultRow[] {
  const notes: string[] = [];
  if (a === b) notes.push('a = b: the interval is empty, so the integral is 0.');
  else if (a > b) {
    notes.push('a > b: the limits are reversed, so the sign of the integral is flipped.');
  }
  if (r.status === 'divergent') {
    notes.push(
      r.badPoint !== undefined && !Number.isFinite(r.badPoint)
        ? `The integral diverges at ${r.badPoint > 0 ? '∞' : '-∞'}: the tail does not converge.`
        : 'The integral diverges (it has no finite value).',
    );
  }
  if (r.status === 'undefined') notes.push('f is undefined somewhere inside [a, b].');
  if (r.status === 'inaccurate') {
    notes.push('The result is approximate: the integrand is hard to integrate numerically.');
  }
  const finite = r.status === 'ok' || r.status === 'inaccurate';
  const rows: ResultRow[] = [
    {
      label: `∫ [${formatValue(a)}, ${formatValue(b)}] ${expr} dx`,
      value: statusValueText(r.status, r.value, r.badPoint),
      approx: r.status === 'inaccurate',
      error: finite && r.error > 1e-9 ? `± ${formatValue(r.error)}` : undefined,
      notes,
    },
  ];
  if (absArea !== undefined && finite) {
    rows.push({
      label: `Total area |${expr}| on [${formatValue(a)}, ${formatValue(b)}]`,
      value: formatValue(absArea),
      approx: r.status === 'inaccurate',
    });
  }
  return rows;
}

/** Label for an area result: limits plus the curve names (`A [0, 1]: f1, f2`). */
export function areaLabel(a: number, b: number, names: readonly string[]): string {
  return `A [${formatValue(a)}, ${formatValue(b)}]: ${names.join(', ')}`;
}

/** Notes for the area tool's limits. `computeAreaRegions` returns no regions when a >= b, so the
 *  area shown is 0 in both cases (it is NOT computed on the reversed interval). */
export function areaLimitNotes(a: number, b: number): string[] {
  if (a === b) return ['a = b: the interval is empty, so the area is 0.'];
  if (a > b) {
    return ['a > b: the limits are reversed and no area is computed (shown as 0). Set a < b.'];
  }
  return [];
}

export interface RegionLike {
  a: number;
  b: number;
  area: number;
  status: QuadratureStatus;
  badPoint?: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
}

/** Total of multi-curve regions: divergent if any region diverges, undefined if any is undefined
 *  (and none diverge), otherwise the finite sum. */
export function sumRegions(regions: readonly RegionLike[]): {
  status: QuadratureStatus;
  value: number;
} {
  if (regions.some((r) => r.status === 'divergent' || r.area === Infinity)) {
    return { status: 'divergent', value: Infinity };
  }
  if (regions.some((r) => r.status === 'undefined' || Number.isNaN(r.area))) {
    return { status: 'undefined', value: NaN };
  }
  let total = 0;
  for (const r of regions) total += r.area;
  return {
    status: regions.some((r) => r.status === 'inaccurate') ? 'inaccurate' : 'ok',
    value: total,
  };
}

/** Display text for one region's area ("divergent" / "undefined" instead of Infinity / NaN). */
export function regionAreaText(r: RegionLike): string {
  if (r.status === 'divergent' || r.area === Infinity) return 'divergent';
  if (r.status === 'undefined' || Number.isNaN(r.area)) return 'undefined';
  return (r.status === 'inaccurate' ? '≈ ' : '') + formatValue(r.area);
}

/** Field-level message for a limit that failed to parse. */
export function limitErrorMessage(invalid: boolean): string | null {
  return invalid ? 'Enter a number or constant expression, e.g. 2, pi/2, sqrt(3).' : null;
}

/** Serialises table rows as CSV (header + one line per row; fields quoted only if needed). */
export function tableToCsv(
  header: [string, string],
  rows: ReadonlyArray<{ input: string; output: string }>,
): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [header, ...rows.map((r): [string, string] => [r.input, r.output])]
    .map((cols) => cols.map(esc).join(','))
    .join('\n');
}

const pt = (p: { x: number; y: number }) => `(${formatValue(p.x)}, ${formatValue(p.y)})`;

/** Human-readable "label: value" lines for a recognised conic (type, centre, foci, ...). */
export function conicInfoLines(info: ConicInfo): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [{ label: 'Type', value: info.type }];
  if (info.center) lines.push({ label: 'Center', value: pt(info.center) });
  if (info.radius !== undefined) lines.push({ label: 'Radius', value: formatValue(info.radius) });
  if (info.vertices?.length) {
    lines.push({ label: 'Vertices', value: info.vertices.map(pt).join(', ') });
  }
  if (info.foci?.length) lines.push({ label: 'Foci', value: info.foci.map(pt).join(', ') });
  if (info.eccentricity !== undefined) {
    lines.push({ label: 'Eccentricity', value: formatValue(info.eccentricity) });
  }
  if (info.directrix) lines.push({ label: 'Directrix', value: info.directrix });
  if (info.asymptotes?.length) {
    lines.push({ label: 'Asymptotes', value: info.asymptotes.join(', ') });
  }
  return lines;
}
