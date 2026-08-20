import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeroSection } from './sections/hero-section/hero-section';
import { AboutMe } from './sections/about-me/about-me';
import { ProjectsSection } from './sections/projects-section/projects-section';

@Component({
  selector: 'app-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroSection, AboutMe, ProjectsSection],
  template: `
    <app-hero-section />
    <app-about-me />
    <app-projects-section />
  `,
})
export class PortfolioComponent {}
