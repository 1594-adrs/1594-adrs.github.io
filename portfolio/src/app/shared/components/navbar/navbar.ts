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
import { NavLink } from '../../models/portfolio.models';
import { NAV_LINKS } from '../../data/portfolio.data';

const MOBILE_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
})
export class Navbar implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer?: IntersectionObserver;
  private mobileQuery?: MediaQueryList;
  private onMobileQueryChange = (e: MediaQueryListEvent) => this.isMobileMenu.set(e.matches);

  menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  isMenuOpen = signal(false);
  activeLink = signal('home');
  isMobileMenu = signal(false);

  navLinks: NavLink[] = NAV_LINKS;

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

  scrollToSection(linkId: string) {
    this.activeLink.set(linkId);
    this.isMenuOpen.set(false);
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
