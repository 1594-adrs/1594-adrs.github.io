import { Component, signal, ChangeDetectionStrategy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'onWindowScroll()',
  },
  templateUrl: './progress-bar.html',
  styleUrls: ['./progress-bar.css'],
})
export class ProgressBar {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  scrollProgress = signal(0);

  onWindowScroll() {
    if (!this.isBrowser) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;

    if (scrollHeight > 0) {
      const progress = (scrollTop / scrollHeight) * 100;
      this.scrollProgress.set(Math.min(100, Math.max(0, progress)));
    }
  }
}
