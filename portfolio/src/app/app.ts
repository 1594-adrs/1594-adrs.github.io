import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraDeProgreso } from './components/barra-de-progreso/barra-de-progreso';
import { HeroSection } from './sections/hero-section/hero-section';
import { BarraDeNavegacionComponent } from './components/barra-de-navegacion/barra-de-navegacion';
import { BotonesDeRedesComponent } from './components/botones-de-redes/botones-de-redes';
import { ProjectsSection } from './sections/projects-section/projects';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BarraDeProgreso, HeroSection, BarraDeNavegacionComponent, BotonesDeRedesComponent, ProjectsSection],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('portfolio');
}