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

@Component({
  selector: 'app-loading-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-screen.html',
  styleUrls: ['./loading-screen.css'],
})
export class LoadingScreen implements OnInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  visible = signal(true);
  fadingOut = signal(false);

  private fadeTimerId: ReturnType<typeof setTimeout> | null = null;
  private hideTimerId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    if (!this.isBrowser) {
      this.visible.set(false);
      return;
    }

    this.fadeTimerId = setTimeout(() => {
      this.fadingOut.set(true);
      this.hideTimerId = setTimeout(() => {
        this.visible.set(false);
      }, 600);
    }, 1800);
  }

  ngOnDestroy() {
    if (this.fadeTimerId !== null) clearTimeout(this.fadeTimerId);
    if (this.hideTimerId !== null) clearTimeout(this.hideTimerId);
  }
}
