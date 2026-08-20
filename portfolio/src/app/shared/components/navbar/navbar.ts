import {
  Component,
  ChangeDetectionStrategy,
  signal,
  HostListener,
  PLATFORM_ID,
  inject,
  AfterViewInit,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { navLinks, socialNetworks } from '../../data/portfolio.data';
import { NavLink, SocialNetwork } from '../../models/portfolio.models';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
})
export class Navbar implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);

  isMenuOpen = signal(false);
  activeLink = signal('about');
  isScrolled = signal(false);

  navLinks: NavLink[] = navLinks;
  networks: SocialNetwork[] = socialNetworks;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.setupScrollSpy();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled.set(window.scrollY > 50);
  }

  private setupScrollSpy() {
    const sections = document.querySelectorAll('section[id]');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.activeLink.set(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -60% 0px' },
    );

    sections.forEach((section) => {
      observer.observe(section);
    });
  }

  toggleMenu() {
    this.isMenuOpen.update((val) => !val);
  }

  setActive(id: string) {
    this.activeLink.set(id);
    this.isMenuOpen.set(false);
  }

  downloadCV() {
    // Basic implementation since there's no actual cv path
    console.log('Downloading CV');
  }
}
