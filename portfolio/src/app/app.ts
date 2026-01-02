import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraDeProgreso } from './components/barra-de-progreso/barra-de-progreso';
import { HeroSection } from './components/hero-section/hero-section';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BarraDeProgreso, HeroSection],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('portfolio');
}