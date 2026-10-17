import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MathInput } from '../math-input/math-input';
import { MathRendererComponent } from '../math-renderer/math-renderer.component';
import {
  CalculusToolState,
  MAX_NEWTON_STEPS,
  MAX_ODE_ROWS,
  MAX_TAYLOR_ORDER,
  type CalculusMode,
  type LimitSide,
  type OdeSolver,
  type SeriesView,
} from '../../state/calculus-tool.state';
import { parseLimitText } from '../../engine/parse-limit';
import { COLOR_SEQ_PARTIAL, COLOR_SEQ_SUM, COLOR_SEQ_TERM } from '../../canvas/calculus-renderer';
import { COLOR_ODE_SOLUTION, COLOR_SLOPE_FIELD } from '../../canvas/slope-field-renderer';
import { formatValue } from '../../utils/format-value';

const ANNOUNCE_DELAY_MS = 700;
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (k: number) => String(k).replace(/\d/g, (d) => SUB[Number(d)]);

/** "Calculus" tool tab: limits, Newton's method, Taylor polynomials, slope fields and series. */
@Component({
  selector: 'app-calculus-panel',
  imports: [MathInput, MathRendererComponent],
  templateUrl: './calculus-panel.html',
  styleUrls: ['./calculus-panel.css', './calculus-panel-modes.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculusPanel {
  readonly state = inject(CalculusToolState);
  protected readonly maxSteps = MAX_NEWTON_STEPS;
  protected readonly maxOrder = MAX_TAYLOR_ORDER;
  protected readonly maxOdeRows = MAX_ODE_ROWS;
  protected readonly modes: { value: CalculusMode; label: string; aria: string }[] = [
    { value: 'limit', label: 'Limit', aria: 'Limit' },
    { value: 'newton', label: 'Newton', aria: "Newton's method" },
    { value: 'taylor', label: 'Taylor', aria: 'Taylor polynomial' },
    { value: 'ode', label: 'ODE', aria: 'ODE slope field' },
    { value: 'series', label: 'Series', aria: 'Series' },
  ];
  protected readonly sides: { value: LimitSide; label: string; aria: string }[] = [
    { value: 'both', label: 'Both', aria: 'Both sides' },
    { value: '-', label: 'x → a⁻', aria: 'From the left' },
    { value: '+', label: 'x → a⁺', aria: 'From the right' },
  ];
  protected readonly methods: { value: OdeSolver; label: string; aria: string }[] = [
    { value: 'rk45', label: 'RK45', aria: 'Adaptive Runge–Kutta (RK45)' },
    { value: 'euler', label: 'Euler', aria: 'Euler, fixed step' },
    { value: 'rk4', label: 'RK4', aria: 'Runge–Kutta 4, fixed step' },
  ];
  /** Canvas colours for the legends (the renderers' own constants, not copies). */
  protected readonly colors = {
    term: COLOR_SEQ_TERM,
    partial: COLOR_SEQ_PARTIAL,
    sum: COLOR_SEQ_SUM,
    field: COLOR_SLOPE_FIELD,
    solution: COLOR_ODE_SOLUTION,
  };
  protected readonly format = formatValue;
  protected readonly sub = sub;

  /** "x → 0⁺", "x → ∞". */
  protected readonly approach = computed(() => {
    const x0 = this.state.limitX0().value;
    if (x0 === null || Number.isNaN(x0)) return 'x → ?';
    const side = this.state.side();
    const mark = Number.isFinite(x0) && side !== 'both' ? (side === '-' ? '⁻' : '⁺') : '';
    return `x → ${formatValue(x0)}${mark}`;
  });

  // Per-field checks for the ODE / series inputs (the view reports only its first error).
  private readonly finite = (text: string) => {
    const r = parseLimitText(text);
    return r.value !== null && Number.isFinite(r.value);
  };
  protected readonly fixedStep = computed(() => this.state.odeMethod() !== 'rk45');
  protected readonly odeErrors = computed(() => {
    const view = this.state.ode();
    const end = parseLimitText(this.state.odeXEndText());
    const h = parseLimitText(this.state.odeStepText()).value;
    return {
      slope: view?.error?.startsWith('y′: ') ? view.error.slice(4) : null,
      x0: this.finite(this.state.odeX0Text()) ? null : 'x₀ must be a finite number.',
      y0: this.finite(this.state.odeY0Text()) ? null : 'y₀ must be a finite number.',
      step:
        this.fixedStep() && (h === null || h === 0 || !Number.isFinite(h))
          ? 'h must be a nonzero number.'
          : null,
      end:
        end.invalid || (end.value !== null && !Number.isFinite(end.value))
          ? 'Target x must be a finite number, or empty.'
          : null,
    };
  });
  /** A view error no field above owns (e.g. the solver failing). */
  protected readonly odeOtherError = computed(() => {
    const err = this.state.ode()?.error ?? null;
    const e = this.odeErrors();
    return err && !(e.slope || e.x0 || e.y0 || e.step || e.end) ? err : null;
  });
  protected readonly seriesErrors = computed(() => {
    const view = this.state.series();
    const start = parseLimitText(this.state.seriesStartText()).value;
    return {
      term: view?.error?.startsWith('aₙ: ') ? view.error.slice(4) : null,
      start:
        start === null || !Number.isInteger(start) || Math.abs(start) > 1e6
          ? 'The first n must be a whole number.'
          : null,
    };
  });

  /** Headline for the series sum: the value, or the way it diverges. */
  protected sumHeadline(v: SeriesView): string {
    if (v.sum.status === 'finite') return v.sumText;
    if (v.sum.status === 'unknown') return 'could not determine';
    return 'diverges';
  }

  /** Why the sum reads as it does: where Sₙ goes and where the terms go. */
  protected sumDetail(v: SeriesView): string {
    const lim = v.limit;
    const terms =
      lim.status === 'finite' && lim.value !== 0
        ? `aₙ → ${v.limitText}, not 0, so the terms never stop adding up.`
        : `aₙ → ${v.limitText}.`;
    if (v.sum.status === 'infinite') return `Sₙ → ${v.sumText}. ${terms}`;
    if (v.sum.status === 'dne') return `Sₙ does not settle. ${terms}`;
    return terms;
  }

  protected readonly odeMethodLabel = computed(
    () => this.methods.find((m) => m.value === this.state.odeMethod())!.label,
  );

  /** Result as one sentence for screen readers (caption, value and detail separated by punctuation). */
  private readonly liveText = computed(() => {
    switch (this.state.mode()) {
      case 'limit': {
        const lim = this.state.limit();
        if (!lim) return 'Enter the point x approaches.';
        const detail = lim.detail ? ` ${lim.detail}` : '';
        return `Limit ${this.approach()} of f${lim.fnIndex + 1}(x): ${lim.text}.${detail}`;
      }
      case 'newton': {
        const blocked = this.state.newtonBlocked();
        if (blocked) return blocked;
        const run = this.state.newton();
        if (!run) return '';
        const settled = run.status === 'converged' || run.status === 'steps';
        const head = settled
          ? `${run.status === 'converged' ? 'Root of' : 'Iterate of'} f${run.fnIndex + 1}: ${formatValue(run.value)}. `
          : '';
        return head + run.message;
      }
      case 'taylor': {
        const blocked = this.state.taylorBlocked();
        if (blocked) return blocked;
        if (this.state.taylorCenter().invalid) return 'The center a must be a finite number.';
        if (this.state.taylorOrder().invalid)
          return `The order must be a whole number from 0 to ${MAX_TAYLOR_ORDER}.`;
        const t = this.state.taylor();
        if (!t) return '';
        if (t.message) return t.message;
        return `Taylor polynomial of order ${t.order} of f${t.fnIndex + 1} about x = ${formatValue(t.center)}: ${t.text}.`;
      }
      case 'ode': {
        const e = this.odeErrors();
        const first = e.slope ?? e.x0 ?? e.y0 ?? e.step ?? e.end ?? this.odeOtherError();
        if (first) return first;
        const v = this.state.ode();
        if (!v) return '';
        return v.text ?? 'Slope field drawn. Enter a target x to read y there.';
      }
      case 'series': {
        const e = this.seriesErrors();
        if (e.term ?? e.start) return (e.term ?? e.start)!;
        const v = this.state.series();
        if (!v) return '';
        if (v.message) return v.message;
        return `Sum of aₙ from n = ${v.n0}: ${this.sumHeadline(v)}. ${this.sumDetail(v)}`;
      }
    }
  });

  /** `liveText` once typing pauses, so the live region does not re-announce every keystroke. */
  protected readonly announced = signal('');

  constructor() {
    effect((onCleanup) => {
      const text = this.liveText();
      const id = setTimeout(() => this.announced.set(text), ANNOUNCE_DELAY_MS);
      onCleanup(() => clearTimeout(id));
    });
  }
}
