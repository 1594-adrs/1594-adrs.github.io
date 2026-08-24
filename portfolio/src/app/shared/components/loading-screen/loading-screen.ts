import {
  Component,
  signal,
  ChangeDetectionStrategy,
  OnInit,
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
export class LoadingScreen implements OnInit {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  visible = signal(true);
  fadingOut = signal(false);

  ngOnInit() {
    if (!this.isBrowser) {
      this.visible.set(false);
      return;
    }

    setTimeout(() => {
      this.fadingOut.set(true);
      setTimeout(() => {
        this.visible.set(false);
      }, 600);
    }, 1800);
  }
}
