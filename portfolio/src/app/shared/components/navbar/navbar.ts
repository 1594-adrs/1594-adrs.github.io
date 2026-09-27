import {
  Component,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  OnDestroy,
  AfterViewInit,
  viewChild,
  ElementRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { NavLink, SocialNetwork } from '../../models/portfolio.models';
import { NAV_LINKS, SOCIAL_NETWORKS } from '../../data/portfolio.data';
import { IconComponent } from '../../icons/icon.component';

const MOBILE_QUERY = '(max-width: 960px)';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
  imports: [IconComponent],
  host: { role: 'banner', '(document:click)': 'onDocumentClick($event)' },
})
export class Navbar implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private router = inject(Router);
  private observer?: IntersectionObserver;
  private mobileQuery?: MediaQueryList;
  private onMobileQueryChange = (e: MediaQueryListEvent) => this.isMobileMenu.set(e.matches);

  menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');
  private navRoot = inject(ElementRef<HTMLElement>);

  isMenuOpen = signal(false);
  activeLink = signal('home');
  isMobileMenu = signal(false);

  navLinks: NavLink[] = NAV_LINKS;
  socialNetworks: SocialNetwork[] = SOCIAL_NETWORKS;

  ngAfterViewInit() {
    if (!this.isBrowser) return;

    this.setupObserver();

    if (typeof window.matchMedia !== 'function') return;

    this.mobileQuery = window.matchMedia(MOBILE_QUERY);
    this.isMobileMenu.set(this.mobileQuery.matches);
    this.mobileQuery.addEventListener('change', this.onMobileQueryChange);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.mobileQuery?.removeEventListener('change', this.onMobileQueryChange);
  }

  private setupObserver() {
    this.observer?.disconnect();

    const sectionIds = this.navLinks.filter((l) => !l.isButton).map((l) => l.id);
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeLink.set(entry.target.id);
          }
        }
      },
      { threshold: 0.35 },
    );

    sections.forEach((section) => this.observer!.observe(section));
  }

  reobserve() {
    this.setupObserver();
  }

  toggleMenu() {
    this.isMenuOpen.update((state) => !state);
  }

  closeMenu() {
    if (!this.isMenuOpen()) return;
    this.isMenuOpen.set(false);
    this.menuToggle()?.nativeElement.focus();
  }

  onDocumentClick(event: MouseEvent) {
    if (!this.isMenuOpen()) return;
    const target = event.target as Node;
    if (!this.navRoot.nativeElement.contains(target)) {
      this.isMenuOpen.set(false);
    }
  }

  scrollToSection(linkId: string) {
    this.activeLink.set(linkId);
    this.isMenuOpen.set(false);

    if (this.router.url !== '/' && !this.router.url.startsWith('/#')) {
      this.router.navigateByUrl(`/#${linkId}`).then(() => {
        this.scrollElementIntoView(linkId);
      });
      return;
    }

    this.scrollElementIntoView(linkId);
  }

  private scrollElementIntoView(linkId: string): void {
    const behavior = this.prefersReducedMotion() ? 'auto' : 'smooth';
    document.getElementById(linkId)?.scrollIntoView({ behavior });
  }

  private prefersReducedMotion(): boolean {
    return (
      this.isBrowser &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
