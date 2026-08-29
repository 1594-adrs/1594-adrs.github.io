import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { KEYBOARD_TABS, type KeyDef } from './keyboard-layout';

@Component({
  selector: 'app-onscreen-keyboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onscreen-keyboard.component.html',
  styleUrls: ['./onscreen-keyboard.component.css'],
})
export class OnscreenKeyboardComponent {
  keyPress = output<string>();
  keyAction = output<'backspace' | 'left' | 'right' | 'clear'>();
  tabs = KEYBOARD_TABS;
  activeTab = signal(0);

  get rows(): KeyDef[][] {
    return this.tabs[this.activeTab()].rows;
  }

  setTab(index: number): void {
    this.activeTab.set(index);
  }

  onKey(key: KeyDef): void {
    if (key.action) {
      this.keyAction.emit(key.action);
    } else if (key.insert) {
      this.keyPress.emit(key.insert);
    }
  }
}
