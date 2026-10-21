import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IntegralExtrasState, type RiemannRule } from '../../state/integral-extras.state';
import { formatValue } from '../../utils/format-value';

/** Riemann sums and arc length for the Integral tool. */
@Component({
  selector: 'app-integral-extras',
  templateUrl: './integral-extras.html',
  styleUrl: './integral-extras.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegralExtras {
  readonly state = inject(IntegralExtrasState);
  protected readonly rules: { value: RiemannRule | null; label: string; aria: string }[] = [
    { value: null, label: 'Off', aria: 'Off: no Riemann sum' },
    { value: 'left', label: 'Left', aria: 'Left endpoint rule' },
    { value: 'right', label: 'Right', aria: 'Right endpoint rule' },
    { value: 'mid', label: 'Mid', aria: 'Midpoint rule' },
    { value: 'trap', label: 'Trap', aria: 'Trapezoid rule' },
    { value: 'simpson', label: 'Simpson', aria: "Simpson's rule" },
  ];
  protected readonly fmt = formatValue;
  /** Relative error to 3 significant digits: 18.0%, 0.391%, 6.25e-4%. */
  protected readonly percent = (r: number) => {
    const p = r * 100;
    if (p === 0) return '0%';
    return `${p >= 1e-3 ? Number(p.toPrecision(3)) : p.toExponential(2)}%`;
  };

  protected onN(event: Event): void {
    this.state.riemannNText.set((event.target as HTMLInputElement).value);
  }
}
