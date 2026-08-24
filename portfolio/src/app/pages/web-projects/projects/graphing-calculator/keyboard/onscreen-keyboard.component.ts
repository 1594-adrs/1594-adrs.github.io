import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { KEYBOARD_ROWS, type KeyDef } from './keyboard-layout';

@Component({
  selector: 'app-onscreen-keyboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onscreen-keyboard.component.html',
  styleUrls: ['./onscreen-keyboard.component.css'],
})
export class OnscreenKeyboardComponent {
  keyPress = output<string>();
  keyAction = output<'backspace' | 'left' | 'right' | 'clear'>();
  rows = KEYBOARD_ROWS;

  onKey(key: KeyDef): void {
    if (key.action) {
      this.keyAction.emit(key.action);
    } else if (key.insert) {
      this.keyPress.emit(key.insert);
    }
  }
}
