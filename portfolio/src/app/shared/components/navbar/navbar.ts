import {
  Component,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavLink } from '../../models/portfolio.models';
import { NAV_LINKS } from '../../data/portfolio.data';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
  imports: [RouterLink],
})
export class Navbar implements AfterViewInit, OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer?: IntersectionObserver;

  isMenuOpen = signal(false);
  activeLink = signal('home');

  navLinks: NavLink[] = NAV_LINKS;

  ngAfterViewInit() {
    if (!this.isBrowser) return;

    this.setupObserver();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
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

  setActiveLink(linkId: string) {
    this.activeLink.set(linkId);
    this.isMenuOpen.set(false);
  }
}
