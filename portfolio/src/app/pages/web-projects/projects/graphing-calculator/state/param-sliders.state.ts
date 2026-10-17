import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { WritableSignal } from '@angular/core';
import type { MathExpression, SliderBounds } from '../models/calculator.models';
import { isParamName, sliderName } from '../engine/mode-detector';
import {
  formatSliderValue,
  rowFreeParams,
  sliderEnv,
  type SliderEnv,
  type SliderRowValue,
} from '../engine/params';
import { FUNCTION_COLORS } from '../utils/color';

export const DEFAULT_SLIDER_BOUNDS: SliderBounds = { min: -10, max: 10, step: 0.1 };
const MAX_ROWS = 5;
/** Same cap as share links (share-state MAX_TOOL_BOUND), so every range round-trips. */
const MAX_BOUND = 1e6;

/** A slider row as the UI shows it; `value` is null while the row text is invalid. */
export interface SliderSpec extends SliderBounds {
  name: string;
  value: number | null;
}

/** Parses one non-slider row with the given slider values substituted (the component's parser). */
export type RowParser = (
  fn: MathExpression,
  raw: string,
  values: ReadonlyMap<string, number>,
) => MathExpression;

function sliderRow(fn: MathExpression, s: SliderRowValue): MathExpression {
  const b = fn.slider ?? DEFAULT_SLIDER_BOUNDS;
  const v = s.value;
  // A typed value outside the range widens it.
  const slider = v === null ? b : { ...b, min: Math.min(b.min, v), max: Math.max(b.max, v) };
  return {
    ...fn,
    mode: 'slider',
    ast: null,
    paramX: null,
    paramY: null,
    inequalityOp: undefined,
    missingParams: undefined,
    slider,
    error: s.error,
  };
}

function paramRow(fn: MathExpression, parseRow: RowParser, env: SliderEnv): MathExpression {
  const params = rowFreeParams(fn.raw);
  const row = { ...parseRow(fn, fn.raw, env.values), slider: undefined, missingParams: undefined };
  const missing = params.filter((p) => !env.claimed.has(p));
  const cleared = { ast: null, paramX: null, paramY: null };
  if (missing.length) {
    const error =
      missing.length === 1
        ? `Add a slider for ${missing[0]}`
        : `Add sliders for ${missing.join(', ')}`;
    return { ...row, ...cleared, missingParams: missing, error };
  }
  const broken = params.filter((p) => !env.values.has(p));
  if (broken.length) return { ...row, ...cleared, error: `Fix the value of ${broken.join(', ')}` };
  return row;
}

/**
 * Pure: every row read against the sliders the rows define. Slider rows are always refreshed
 * (cheap); other rows only when in `dirty` (all when omitted).
 */
export function resolveRows(
  fns: MathExpression[],
  parseRow: RowParser,
  dirty?: ReadonlySet<number>,
): MathExpression[] {
  const env = sliderEnv(fns.map((f) => f.raw));
  return fns.map((fn, i) => {
    const s = env.rows[i];
    if (s) return sliderRow(fn, s);
    return dirty && !dirty.has(i) ? fn : paramRow(fn, parseRow, env);
  });
}

/** Names whose value or definedness differs between two slider envs. */
function changedNames(a: SliderEnv, b: SliderEnv): Set<string> {
  const names = new Set([...a.claimed, ...b.claimed]);
  return new Set(
    [...names].filter(
      (n) => a.values.get(n) !== b.values.get(n) || a.claimed.has(n) !== b.claimed.has(n),
    ),
  );
}

/**
 * Free parameters as Desmos-style sliders: a row `a = 2` is the slider, its text the value.
 * Owns re-reading the rows that depend on a parameter when it changes.
 */
@Injectable()
export class ParamSlidersState {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private functions: WritableSignal<MathExpression[]> = signal([]);
  private parseRow: RowParser = (fn) => fn;
  private readonly pending = new Map<number, number>();
  private frame: number | null = null;

  connect(functions: WritableSignal<MathExpression[]>, parseRow: RowParser): void {
    this.functions = functions;
    this.parseRow = parseRow;
  }

  /** Per row: the slider it defines, or null. */
  readonly sliders = computed<(SliderSpec | null)[]>(() => {
    const fns = this.functions();
    const env = sliderEnv(fns.map((f) => f.raw));
    return fns.map((fn, i) => {
      const s = env.rows[i];
      return s && fn.mode === 'slider'
        ? { ...(fn.slider ?? DEFAULT_SLIDER_BOUNDS), name: s.name, value: s.value }
        : null;
    });
  });

  /** Per row: parameters it uses that no slider defines (offer "add slider" for each). */
  readonly missing = computed<string[][]>(() => this.functions().map((f) => f.missingParams ?? []));

  /** Re-reads row `index` as `raw`, plus every row using a parameter whose value changed. */
  updateRow(index: number, raw: string): void {
    const fns = this.functions();
    if (!fns[index]) return;
    const before = sliderEnv(fns.map((f) => f.raw));
    const next = fns.map((f, i) => (i === index ? { ...f, raw } : f));
    const after = sliderEnv(next.map((f) => f.raw));
    const changed = changedNames(before, after);
    const dirty = new Set([index]);
    if (changed.size) {
      next.forEach((f, i) => {
        if (!after.rows[i] && rowFreeParams(f.raw).some((p) => changed.has(p))) dirty.add(i);
      });
    }
    this.functions.set(resolveRows(next, this.parseRow, dirty));
  }

  /** Re-reads every row (share-link restore, row removal / reorder change who defines what). */
  resolveAll(): void {
    this.functions.set(resolveRows(this.functions(), this.parseRow));
  }

  /** Slider drag / typed value: rewrites the row to `a = <v>` at the step's precision. Drags are
   *  coalesced to one update per animation frame so dependent rows re-parse at most once a frame. */
  setSliderValue(index: number, value: number): void {
    if (!Number.isFinite(value)) return;
    this.pending.set(index, value);
    if (!this.isBrowser) return this.flush();
    if (this.frame === null) this.frame = requestAnimationFrame(() => this.flush());
  }

  /** Applies pending slider values now (also what the animation frame runs). */
  flush(): void {
    if (this.frame !== null && this.isBrowser) cancelAnimationFrame(this.frame);
    this.frame = null;
    const entries = [...this.pending];
    this.pending.clear();
    for (const [index, value] of entries) {
      const fn = this.functions()[index];
      const name = fn && sliderName(fn.raw);
      if (!name) continue;
      const step = fn.slider?.step ?? DEFAULT_SLIDER_BOUNDS.step;
      this.updateRow(index, `${name} = ${formatSliderValue(value, step)}`);
    }
  }

  /** Edits min / max / step; rejects a non-finite, inverted or empty range. The value is clamped
   *  into the new range (otherwise the next read would widen it back). */
  setSliderBounds(index: number, partial: Partial<SliderBounds>): boolean {
    const fn = this.functions()[index];
    const name = fn && sliderName(fn.raw);
    if (!fn || !name || fn.mode !== 'slider') return false;
    const b = { ...(fn.slider ?? DEFAULT_SLIDER_BOUNDS), ...partial };
    const finite = [b.min, b.max, b.step].every(
      (n) => Number.isFinite(n) && Math.abs(n) <= MAX_BOUND,
    );
    if (!finite || b.min >= b.max || b.step <= 0 || b.step > b.max - b.min) return false;
    const value = this.sliders()[index]?.value ?? null;
    this.functions.update((fns) => fns.map((f, i) => (i === index ? { ...f, slider: b } : f)));
    if (value !== null && (value < b.min || value > b.max)) {
      const clamped = Math.min(b.max, Math.max(b.min, value));
      this.updateRow(index, `${name} = ${formatSliderValue(clamped, b.step)}`);
    }
    return true;
  }

  /** "add slider: a": appends the row `a = 1`. False when rows are full or `a` is defined. */
  addSlider(name: string): boolean {
    const fns = this.functions();
    if (!isParamName(name) || fns.length >= MAX_ROWS) return false;
    if (sliderEnv(fns.map((f) => f.raw)).claimed.has(name)) return false;
    const row: MathExpression = {
      raw: '',
      ast: null,
      color: FUNCTION_COLORS[fns.length % FUNCTION_COLORS.length],
      visible: true,
      mode: 'explicit',
      error: null,
    };
    this.functions.set([...fns, row]);
    this.updateRow(fns.length, `${name} = 1`);
    return true;
  }
}
