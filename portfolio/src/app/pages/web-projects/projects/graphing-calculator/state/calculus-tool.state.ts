import { Injectable, Signal, computed, signal } from '@angular/core';
import { compileExpression } from '../engine/evaluator';
import { computeLimit, type LimitResult } from '../engine/limit';
import { newton, type NewtonStatus } from '../engine/differential';
import { parseLimitText } from '../engine/parse-limit';
import type { MathExpression } from '../models/calculator.models';
import { formatValue } from '../utils/format-value';
import { dependsOn } from '../engine/symbolic-diff';
import { RADIANS_REASON, UNDEFINED_EVERYWHERE_REASON, usesAngleUnit } from './derivative-view';

export type CalculusMode = 'limit' | 'newton';
export type LimitSide = 'both' | '-' | '+';

/** Newton steps accepted in the "steps" field; empty runs until convergence. */
export const MAX_NEWTON_STEPS = 50;

/**
 * Parses the point a limit approaches: everything `parseLimitText` accepts (`pi/2`, `-3`, `e^2`)
 * plus ±infinity typed as `inf`, `infinity`, `oo` or `∞`. The math field turns typed letters into
 * an implicit product (`i*n*f`), so `*` and spaces are ignored for the infinity check.
 */
export function parseLimitPoint(raw: string): { value: number | null; invalid: boolean } {
  const compact = raw
    .replace(/[\s*]/g, '')
    .replace(/\\infty/g, '∞')
    .toLowerCase();
  const inf = /^([+-]?)(inf|infinity|infty|oo|∞)$/.exec(compact);
  if (inf) return { value: inf[1] === '-' ? -Infinity : Infinity, invalid: false };
  return parseLimitText(raw);
}

/** "1", "∞", "-∞", "does not exist", "could not determine". */
export function limitText(r: LimitResult): string {
  if (r.status === 'dne') return 'does not exist';
  if (r.status === 'unknown') return 'could not determine';
  return formatValue(r.value);
}

export interface FunctionChoice {
  index: number;
  label: string;
  color: string;
}

export interface LimitView {
  fnIndex: number;
  color: string;
  x0: number;
  side: LimitSide;
  result: LimitResult;
  text: string;
  /** Why the result is what it is (undefined domain, differing sides, one side missing), if useful. */
  detail: string | null;
}

type SideSupport = 'ok' | 'undefined' | 'nonfinite';

/** Whether f has real values on one side of x0 (or towards ±∞): probes a few offsets. */
function sideSupport(f: (x: number) => number, x0: number, dir: 1 | -1): SideSupport {
  const finite = Number.isFinite(x0);
  let sawInf = false;
  for (let k = 0; k < 10; k++) {
    const t = finite ? 0.13 * Math.max(1, Math.abs(x0)) * 2 ** -k : 1.3 * 2 ** k;
    const y = f(finite ? x0 + dir * t : dir * t);
    if (Number.isFinite(y)) return 'ok';
    if (!Number.isNaN(y)) sawInf = true;
  }
  return sawInf ? 'nonfinite' : 'undefined';
}

const exists = (r: LimitResult) => r.status === 'finite' || r.status === 'infinite';
const missing = (r: LimitResult) =>
  r.status === 'dne' ? 'does not exist' : 'could not be determined';

/** One sentence on why a two-sided limit with real values on both sides failed. */
function explainSides(l: LimitResult, r: LimitResult): string {
  if (exists(l) && exists(r)) {
    return `left ${limitText(l)} · right ${limitText(r)}: the one-sided limits differ.`;
  }
  if (!exists(l) && !exists(r)) {
    return l.status === 'dne' && r.status === 'dne'
      ? 'Neither one-sided limit exists.'
      : `The left-hand limit ${missing(l)} and the right-hand limit ${missing(r)}.`;
  }
  const [name, bad, good] = exists(l) ? ['right', r, l] : ['left', l, r];
  return `The ${name}-hand limit ${missing(bad)} (the ${name === 'left' ? 'right' : 'left'}-hand limit is ${limitText(good)}).`;
}

export interface NewtonRow {
  n: number;
  x: number;
  fx: number;
}

export interface NewtonView {
  fnIndex: number;
  color: string;
  status: NewtonStatus;
  rows: NewtonRow[];
  /** The root / last iterate, NaN on failure. */
  value: number;
  message: string;
}

const NEWTON_MESSAGES: Record<NewtonStatus, (v: NewtonView) => string> = {
  converged: (v) => `Root ≈ ${formatValue(v.value)} after ${v.rows.length - 1} steps.`,
  steps: (v) => `x${v.rows.length - 1} = ${formatValue(v.value)}.`,
  'zero-derivative': (v) =>
    `Stopped: f′(x${v.rows.length - 1}) = 0, the tangent is horizontal and never meets the x-axis.`,
  undefined: (v) => `Stopped: f or f′ is undefined at x${v.rows.length - 1}.`,
  cycle: () => 'Stopped: the iterates cycle without converging.',
  diverged: () => 'Did not converge: the iterates run away. Try another x₀.',
};

/** Signal state for the "Calculus" tool tab (limits and Newton's method). */
@Injectable()
export class CalculusToolState {
  open = signal(false);
  mode = signal<CalculusMode>('limit');
  /** Requested function row; `selected` falls back to the first usable one. */
  fnIndex = signal(0);
  /** Shown when the requested row vanished (removed) and another one took over. */
  removedNotice = signal<string | null>(null);
  limitX0Text = signal('0');
  side = signal<LimitSide>('both');
  newtonX0Text = signal('1');
  stepsText = signal('');

  private functions: Signal<MathExpression[]> = signal([]);
  private angleUnit: Signal<'rad' | 'deg'> = signal('rad');

  connect(functions: Signal<MathExpression[]>, angleUnit: Signal<'rad' | 'deg'>): void {
    this.functions = functions;
    this.angleUnit = angleUnit;
  }

  /** Visible y = f(x) rows with a valid expression. */
  choices = computed<FunctionChoice[]>(() =>
    this.functions()
      .map((f, index) => ({ f, index }))
      .filter(({ f }) => f.visible && f.mode === 'explicit' && !!f.ast)
      .map(({ f, index }) => ({ index, label: `f${index + 1}`, color: f.color })),
  );

  selected = computed<FunctionChoice | null>(() => {
    const list = this.choices();
    return list.find((c) => c.index === this.fnIndex()) ?? list[0] ?? null;
  });

  /** Explicit message when the shown function is not the one asked for. */
  selectionNote = computed<string | null>(() => {
    const sel = this.selected();
    if (!sel) return null;
    if (this.removedNotice()) return `${this.removedNotice()} Showing ${sel.label}.`;
    return sel.index === this.fnIndex()
      ? null
      : `f${this.fnIndex() + 1} cannot be used (hidden or not y = f(x)); showing ${sel.label}.`;
  });

  select(index: number): void {
    this.removedNotice.set(null);
    this.fnIndex.set(index);
  }

  /** Keeps the selection on the same row when a row is removed; says so if it was the one removed. */
  handleFunctionRemoved(index: number): void {
    const cur = this.fnIndex();
    if (cur > index) this.fnIndex.set(cur - 1);
    else if (cur === index) {
      this.fnIndex.set(Math.max(0, index - 1));
      this.removedNotice.set(`f${index + 1} was removed.`);
    }
  }

  /** Keeps the selection on the same row when rows are reordered. */
  handleFunctionMoved(source: number, target: number): void {
    const i = this.fnIndex();
    if (i === source) this.fnIndex.set(target);
    else if (source < target && i > source && i <= target) this.fnIndex.set(i - 1);
    else if (source > target && i >= target && i < source) this.fnIndex.set(i + 1);
  }

  limitX0 = computed(() => parseLimitPoint(this.limitX0Text()));
  newtonX0 = computed(() => {
    const r = parseLimitText(this.newtonX0Text());
    return r.value !== null && !Number.isFinite(r.value) ? { value: null, invalid: true } : r;
  });
  steps = computed<{ value: number | undefined; invalid: boolean }>(() => {
    const t = this.stepsText().trim();
    if (!t) return { value: undefined, invalid: false };
    const n = Number(t);
    return Number.isInteger(n) && n >= 1 && n <= MAX_NEWTON_STEPS
      ? { value: n, invalid: false }
      : { value: undefined, invalid: true };
  });

  private selectedAst = computed(() => {
    const c = this.selected();
    return c ? (this.functions()[c.index]?.ast ?? null) : null;
  });

  /** Newton runs in radians (the engine differentiates there); trig in DEG mode is refused. */
  newtonBlocked = computed(() => {
    const ast = this.selectedAst();
    return !!ast && this.angleUnit() === 'deg' && usesAngleUnit(ast) ? RADIANS_REASON : null;
  });

  limit = computed<LimitView | null>(() => {
    if (!this.open() || this.mode() !== 'limit') return null;
    const c = this.selected();
    const ast = this.selectedAst();
    const x0 = this.limitX0().value;
    if (!c || !ast || x0 === null || Number.isNaN(x0)) return null;
    const compiled = compileExpression(ast, this.angleUnit());
    const f = (x: number) => {
      try {
        return compiled(x, 0);
      } catch {
        return NaN;
      }
    };
    const side = this.side();
    const finiteX0 = Number.isFinite(x0);
    const dirs: (1 | -1)[] = !finiteX0
      ? [x0 > 0 ? 1 : -1]
      : side === 'both'
        ? [-1, 1]
        : [side === '-' ? -1 : 1];
    const support = dirs.map((d) => sideSupport(f, x0, d));
    const at = finiteX0 ? `x = ${formatValue(x0).replace('-', '−')}` : 'large |x|';
    let result: LimitResult;
    let detail: string | null = null;
    if (!dependsOn(ast, 'x') && !Number.isFinite(f(0))) {
      result = { value: NaN, status: 'dne' };
      detail = UNDEFINED_EVERYWHERE_REASON;
    } else if (support.every((s) => s !== 'ok')) {
      // No real values to approach from: never report ±∞ for a constant 1/0 or an empty domain.
      result = { value: NaN, status: 'dne' };
      const where =
        !finiteX0 || side === 'both' ? 'near' : side === '-' ? 'to the left of' : 'to the right of';
      detail = support.includes('undefined')
        ? `f is undefined ${finiteX0 ? where : 'for'} ${at}.`
        : `f is not finite ${finiteX0 ? where : 'for'} ${at}.`;
    } else {
      result = computeLimit(f, x0, side === 'both' ? undefined : side);
      if (support.includes('ok') && support.some((s) => s !== 'ok')) {
        const defined = support[0] === 'ok' ? 'left' : 'right';
        detail = `f is defined only on the ${defined} of ${at}, so this is the ${defined}-hand limit.`;
      } else if (side === 'both' && finiteX0 && result.status === 'dne') {
        detail = explainSides(computeLimit(f, x0, '-'), computeLimit(f, x0, '+'));
      }
    }
    if (!detail && result.status === 'unknown') {
      detail = 'The samples neither settle nor clearly diverge.';
    }
    return {
      fnIndex: c.index,
      color: c.color,
      x0,
      side,
      result,
      text: limitText(result),
      detail,
    };
  });

  newton = computed<NewtonView | null>(() => {
    if (!this.open() || this.mode() !== 'newton' || this.newtonBlocked()) return null;
    const c = this.selected();
    const ast = this.selectedAst();
    const x0 = this.newtonX0().value;
    const steps = this.steps();
    if (!c || !ast || x0 === null || steps.invalid) return null;
    const r = newton(ast, x0, steps.value);
    const compiled = compileExpression(ast, 'rad');
    const rows = r.iterates.map((x, n) => {
      let fx: number;
      try {
        fx = compiled(x, 0);
      } catch {
        fx = NaN;
      }
      return { n, x, fx };
    });
    const view: NewtonView = {
      fnIndex: c.index,
      color: c.color,
      status: r.status,
      rows,
      value: r.value,
      message: '',
    };
    view.message = NEWTON_MESSAGES[r.status](view);
    return view;
  });
}
