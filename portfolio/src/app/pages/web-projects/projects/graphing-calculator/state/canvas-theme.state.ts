import { Injectable, computed, signal } from '@angular/core';
import { paletteFor, type CanvasTheme } from '../canvas/palette';

@Injectable()
export class CanvasThemeState {
  readonly theme = signal<CanvasTheme>('dark');
  readonly palette = computed(() => paletteFor(this.theme()));
  readonly isLight = computed(() => this.theme() === 'light');

  toggle(): void {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }
}
