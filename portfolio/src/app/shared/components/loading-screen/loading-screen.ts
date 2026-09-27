import {
  Component,
  signal,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const SESSION_KEY = 'loading-screen-shown';
const FADE_DELAY_MS = 400;
const FADE_DURATION_MS = 200;

@Component({
  selector: 'app-loading-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-screen.html',
  styleUrls: ['./loading-screen.css'],
})
export class LoadingScreen implements OnInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  visible = signal(this.computeInitialVisible());
  fadingOut = signal(false);

  private fadeTimerId: ReturnType<typeof setTimeout> | null = null;
  private hideTimerId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    if (!this.visible()) return;

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — proceed without persisting.
    }

    this.fadeTimerId = setTimeout(() => {
      this.fadingOut.set(true);
      this.hideTimerId = setTimeout(() => {
        this.visible.set(false);
      }, FADE_DURATION_MS);
    }, FADE_DELAY_MS);
  }

  ngOnDestroy() {
    if (this.fadeTimerId !== null) clearTimeout(this.fadeTimerId);
    if (this.hideTimerId !== null) clearTimeout(this.hideTimerId);
  }

  private computeInitialVisible(): boolean {
    if (!this.isBrowser) return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;

    try {
      return sessionStorage.getItem(SESSION_KEY) !== '1';
    } catch {
      return true;
    }
  }
}
