import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface NavLink {
  label: string;
  href: string;
  id: string;
  isButton?: boolean;
}

@Component({
  selector: 'app-barra-de-navegacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barra-de-navegacion.html',
  styleUrls: ['./barra-de-navegacion.css']
})
export class BarraDeNavegacionComponent {
  isMenuOpen = signal(false);
  activeLink = signal('inicio');

  navLinks: NavLink[] = [
    { label: 'Home', href: '#inicio', id: 'inicio' },
    { label: 'About Me', href: '#sobre-mi', id: 'sobre-mi' },
    { label: 'Projects', href: '#proyectos', id: 'proyectos' },
    { label: 'Download CV', href: '/Andres_Rincon_CV.pdf', id: 'cv', isButton: true }
  ];

  toggleMenu() {
    this.isMenuOpen.update(state => !state);
  }

  setActiveLink(linkId: string) {
    this.activeLink.set(linkId);
    this.isMenuOpen.set(false);
  }

  downloadCV() {
    window.open('/Andres_Rincon_CV.pdf', '_blank');
  }
}

