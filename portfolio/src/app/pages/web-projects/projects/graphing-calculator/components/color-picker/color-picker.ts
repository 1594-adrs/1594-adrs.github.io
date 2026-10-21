import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FUNCTION_COLORS } from '../../utils/color';

/** Small swatch button that opens a popover with the 5 palette presets plus a native
 *  color input, for recoloring one plotted function. Emits `colorChange` on any pick. */
@Component({
  selector: 'app-color-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.css',
})
export class ColorPicker {
  color = input.required<string>();
  label = input('Color');

  colorChange = output<string>();

  open = signal(false);

  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly presets = FUNCTION_COLORS;

  toggle(): void {
    this.open.update((v) => !v);
  }

  choose(value: string): void {
    this.colorChange.emit(value);
    this.close();
  }

  onCustomColor(value: string): void {
    this.colorChange.emit(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  private close(): void {
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('.color-swatch-btn')?.focus();
  }
}
