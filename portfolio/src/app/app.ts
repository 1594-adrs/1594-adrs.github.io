import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  OnDestroy,
  viewChild,
  AfterViewChecked,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Navbar } from './shared/components/navbar/navbar';
import { ProgressBar } from './shared/components/progress-bar/progress-bar';
import { SocialButtons } from './shared/components/social-buttons/social-buttons';
import { LoadingScreen } from './shared/components/loading-screen/loading-screen';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Navbar, ProgressBar, SocialButtons, LoadingScreen],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewChecked {
  private router = inject(Router);
  private sub?: Subscription;

  isAppPage = signal(true);
  private needsReobserve = false;

  navbar = viewChild(Navbar);

  ngOnInit() {
    this.updateState(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const prev = this.isAppPage();
        this.updateState(e.urlAfterRedirects || e.url);
        if (!prev && this.isAppPage()) {
          this.needsReobserve = true;
        }
      });
  }

  ngAfterViewChecked() {
    if (this.needsReobserve) {
      this.needsReobserve = false;
      this.navbar()?.reobserve();
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private updateState(url: string) {
    this.isAppPage.set(!url.startsWith('/web-projects'));
  }
}
