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
    { keys: 'Esc', action: 'Clear pinned labels' },
  ];
}
