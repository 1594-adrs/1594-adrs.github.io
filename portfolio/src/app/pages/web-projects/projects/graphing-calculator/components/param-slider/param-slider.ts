import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import type { SliderBounds } from '../../models/calculator.models';
import type { SliderSpec } from '../../state/param-sliders.state';

type Field = keyof SliderBounds;

/** Compact slider under a `a = 2` row: range input plus editable min / max / step. */
@Component({
  selector: 'app-param-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './param-slider.html',
  styleUrl: './param-slider.css',
})
export class ParamSlider {
  readonly spec = input.required<SliderSpec>();

  readonly valueChange = output<number>();
  /** The parent validates; an unaccepted change leaves `spec` as is and the field reverts. */
  readonly boundsChange = output<Partial<SliderBounds>>();

  protected readonly invalid = signal<Field | null>(null);
  private readonly injector = inject(Injector);

  protected onRange(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onBound(field: Field, event: Event): void {
    const el = event.target as HTMLInputElement;
    const text = el.value.trim();
    const n = text === '' ? NaN : Number(text);
    this.invalid.set(null);
    this.boundsChange.emit({ [field]: n });
    // Once the parent has re-rendered, `spec` shows whether the state accepted the value.
    afterNextRender(
      () => {
        const current = this.spec()[field];
        if (current !== n) {
          el.value = String(current);
          this.invalid.set(field);
        }
      },
      { injector: this.injector },
    );
  }
}
