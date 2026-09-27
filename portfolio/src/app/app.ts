import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  OnDestroy,
  viewChild,
  AfterViewChecked,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Navbar } from './shared/components/navbar/navbar';
import { ProgressBar } from './shared/components/progress-bar/progress-bar';
import { SocialButtons } from './shared/components/social-buttons/social-buttons';
import { LoadingScreen } from './shared/components/loading-screen/loading-screen';
import { PhosphorField } from './shared/components/phosphor-field/phosphor-field';
import { Profile, SocialNetwork } from './shared/models/portfolio.models';
import { PROFILE, SOCIAL_NETWORKS } from './shared/data/portfolio.data';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Navbar, ProgressBar, SocialButtons, LoadingScreen, PhosphorField],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewChecked {
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private scrollbarQuery?: MediaQueryList;
  private onScrollbarQueryChange = () => this.updateScrollbarClass();

  isAppPage = signal(true);
  private needsReobserve = false;

  profile: Profile = PROFILE;
  socialNetworks: SocialNetwork[] = SOCIAL_NETWORKS;

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
        this.updateScrollbarClass();
      });

    if (this.isBrowser && typeof window.matchMedia === 'function') {
      this.scrollbarQuery = window.matchMedia('(min-width: 769px) and (pointer: fine)');
      this.scrollbarQuery.addEventListener('change', this.onScrollbarQueryChange);
      this.updateScrollbarClass();
    }
  }

  ngAfterViewChecked() {
    if (this.needsReobserve) {
      this.needsReobserve = false;
      this.navbar()?.reobserve();
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.scrollbarQuery?.removeEventListener('change', this.onScrollbarQueryChange);
  }

  private updateState(url: string) {
    this.isAppPage.set(!url.startsWith('/web-projects'));
  }

  private updateScrollbarClass() {
    if (!this.isBrowser) return;
    const shouldHideNative = this.isAppPage() && (this.scrollbarQuery?.matches ?? false);
    document.documentElement.classList.toggle('has-custom-scrollbar', shouldHideNative);
  }
}
