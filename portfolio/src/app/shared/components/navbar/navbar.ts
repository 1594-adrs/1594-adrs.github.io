import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { NavLink } from '../../models/portfolio.models';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
})
export class Navbar {
  isMenuOpen = signal(false);
  activeLink = signal('home');

  navLinks: NavLink[] = [
    { label: 'Home', href: '#home', id: 'home' },
    { label: 'About Me', href: '#about', id: 'about' },
    { label: 'Projects', href: '#projects', id: 'projects' },
    { label: 'Download CV', href: '/Andres_Rincon_CV.pdf', id: 'cv', isButton: true },
  ];

  toggleMenu() {
    this.isMenuOpen.update((state) => !state);
  }

  setActiveLink(linkId: string) {
    this.activeLink.set(linkId);
    this.isMenuOpen.set(false);
  }

  downloadCV() {
    window.open('/Andres_Rincon_CV.pdf', '_blank');
  }
}
