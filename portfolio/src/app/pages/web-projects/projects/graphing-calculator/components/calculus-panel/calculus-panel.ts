import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MathInput } from '../math-input/math-input';
import {
  CalculusToolState,
  MAX_NEWTON_STEPS,
  type LimitSide,
} from '../../state/calculus-tool.state';
import { formatValue } from '../../utils/format-value';

const ANNOUNCE_DELAY_MS = 700;

/** "Calculus" tool tab: numeric limits and Newton's method on a y = f(x) row. */
@Component({
  selector: 'app-calculus-panel',
  imports: [MathInput],
  templateUrl: './calculus-panel.html',
  styleUrl: './calculus-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculusPanel {
  readonly state = inject(CalculusToolState);
  protected readonly maxSteps = MAX_NEWTON_STEPS;
  protected readonly sides: { value: LimitSide; label: string; aria: string }[] = [
    { value: 'both', label: 'Both', aria: 'Both sides' },
    { value: '-', label: 'x → a⁻', aria: 'From the left' },
    { value: '+', label: 'x → a⁺', aria: 'From the right' },
  ];
  protected readonly format = formatValue;

  /** "x → 0⁺", "x → ∞". */
  protected readonly approach = computed(() => {
    const x0 = this.state.limitX0().value;
    if (x0 === null || Number.isNaN(x0)) return 'x → ?';
    const side = this.state.side();
    const mark = Number.isFinite(x0) && side !== 'both' ? (side === '-' ? '⁻' : '⁺') : '';
    return `x → ${formatValue(x0)}${mark}`;
  });

  /** Result as one sentence for screen readers (caption, value and detail separated by punctuation). */
  private readonly liveText = computed(() => {
    if (this.state.mode() === 'limit') {
      const lim = this.state.limit();
      if (!lim) return 'Enter the point x approaches.';
      const detail = lim.detail ? ` ${lim.detail}` : '';
      return `Limit ${this.approach()} of f${lim.fnIndex + 1}(x): ${lim.text}.${detail}`;
    }
    const blocked = this.state.newtonBlocked();
    if (blocked) return blocked;
    const run = this.state.newton();
    if (!run) return '';
    const settled = run.status === 'converged' || run.status === 'steps';
    const head = settled
      ? `${run.status === 'converged' ? 'Root of' : 'Iterate of'} f${run.fnIndex + 1}: ${formatValue(run.value)}. `
      : '';
    return head + run.message;
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
