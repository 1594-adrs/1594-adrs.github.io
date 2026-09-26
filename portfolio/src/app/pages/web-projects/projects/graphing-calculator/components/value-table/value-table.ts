import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { evalExpression, evaluate } from '../../engine/evaluator';
import { formatValue } from '../../utils/format-value';
import type { MathExpression } from '../../models/calculator.models';

const DEFAULT_START = '0';
const DEFAULT_STEP = '1';
const DEFAULT_ROWS = '11';
const MAX_ROWS = 200;

export interface ValueTableRow {
  input: number;
  output: string;
}

/** Table of values for a selected visible explicit (y = f(x)) or explicit-y (x = g(y)) function:
 *  start/step/row-count controls with inline validation, computed rows, "—" for undefined. */
@Component({
  selector: 'app-value-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './value-table.html',
  styleUrl: './value-table.css',
})
export class ValueTable {
  expr = input.required<MathExpression>();
  index = input(0);
  angleUnit = input<'deg' | 'rad'>('rad');
  close = output<void>();

  startText = signal(DEFAULT_START);
  stepText = signal(DEFAULT_STEP);
  rowsText = signal(DEFAULT_ROWS);

  private startParsed = computed(() => parseNumberField(this.startText()));
  private stepParsed = computed(() => parseNumberField(this.stepText()));
  private rowsParsed = computed(() => parseRowsField(this.rowsText()));

  startError = computed(() => (this.startParsed().valid ? null : 'Enter a number.'));
  stepError = computed(() =>
    !this.stepParsed().valid
      ? 'Enter a number.'
      : this.stepParsed().value === 0
        ? 'Step must not be 0.'
        : null,
  );
  rowsError = computed(() => {
    const { valid, value } = this.rowsParsed();
    if (!valid) return 'Enter a whole number.';
    if (value < 1) return 'Enter at least 1 row.';
    if (value > MAX_ROWS) return `Enter at most ${MAX_ROWS} rows.`;
    return null;
  });

  /** Column variable: 'x' for explicit y = f(x) rows, 'y' for explicit-y x = g(y) rows. */
  inputVariable = computed(() => (this.expr().mode === 'explicit-y' ? 'y' : 'x'));

  caption = computed(() => {
    const e = this.expr();
    const label = `f${this.index() + 1}`;
    return e.mode === 'explicit-y'
      ? `Values of ${label}: x = ${e.raw}`
      : `Values of ${label}: y = ${e.raw}`;
  });

  rows = computed<ValueTableRow[]>(() => {
    if (this.startError() || this.stepError() || this.rowsError()) return [];
    const e = this.expr();
    if (!e.ast) return [];
    const start = this.startParsed().value;
    const step = this.stepParsed().value;
    const count = this.rowsParsed().value;
    const au = this.angleUnit();
    const variable = this.inputVariable();
    const out: ValueTableRow[] = [];
    for (let i = 0; i < count; i++) {
      const t = start + i * step;
      let value: number;
      try {
        value =
          variable === 'y'
            ? evaluate(e.ast, { y: t }, au)
            : evalExpression(e.ast, t, undefined, au);
      } catch {
        value = NaN;
      }
      out.push({ input: t, output: isFinite(value) ? formatValue(value) : '—' });
    }
    return out;
  });

  setStart(value: string): void {
    this.startText.set(value);
  }

  setStep(value: string): void {
    this.stepText.set(value);
  }

  setRows(value: string): void {
    this.rowsText.set(value);
  }

  /** Formats the input (x or y) column like a typed value — e.g. "1", "2.5", "-0.25" —
   *  rather than `formatValue`'s fixed 6-decimal display used for computed outputs. */
  formatInput(v: number): string {
    if (Number.isNaN(v)) return 'undefined';
    if (!Number.isFinite(v)) return formatValue(v);
    if (Math.abs(v) < 1e-10) return '0';
    if (Math.abs(v) >= 1e12 || Math.abs(v) < 0.001) return formatValue(v);
    return v
      .toFixed(6)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
  }
}

function parseNumberField(raw: string): { valid: boolean; value: number } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, value: NaN };
  const value = Number(trimmed);
  return { valid: Number.isFinite(value), value };
}

function parseRowsField(raw: string): { valid: boolean; value: number } {
  const trimmed = raw.trim();
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return { valid: false, value: NaN };
  const value = Number(trimmed);
  return { valid: Number.isInteger(value), value };
}
