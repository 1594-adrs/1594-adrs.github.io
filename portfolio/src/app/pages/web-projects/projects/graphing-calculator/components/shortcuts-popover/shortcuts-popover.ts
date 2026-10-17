import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { IconComponent } from '../../../../../../shared/icons/icon.component';

/** Small popover listing the canvas's keyboard shortcuts. Separate from the full
 *  help modal (`app-help-modal`) — this is a quick reference reachable from the
 *  canvas controls, not a walkthrough. */
@Component({
  selector: 'app-shortcuts-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './shortcuts-popover.html',
  styleUrl: './shortcuts-popover.css',
  host: {
    role: 'dialog',
    'aria-label': 'Keyboard shortcuts',
    '(keydown.escape)': 'close.emit()',
  },
})
export class ShortcutsPopover {
  close = output<void>();

  shortcuts = [
    { keys: '+ / −', action: 'Zoom in / out' },
    { keys: '↑ ↓ ← →', action: 'Pan the graph' },
    { keys: 'R', action: 'Reset view' },
    { keys: 'P', action: 'Cycle points of interest' },
    { keys: 'T', action: 'Tangent at the traced point (also the tangent button)' },
    { keys: 'N', action: 'Normal line at the traced point (also the normal button)' },
    { keys: 'f′ button', action: 'Plot the derivative of a y = f(x) row (dashed)' },
    { keys: 'Calculus', action: 'Tab: limit (inf, -inf, side) and Newton x₀/steps' },
    {
      keys: 'Touch',
      action: 'Hold a finger on a curve to trace it; it stays until you tap elsewhere',
    },
    { keys: 'Touch', action: 'Drag to pan, pinch to zoom' },
    { keys: 'Esc', action: 'Clear pinned labels' },
  ];
}
