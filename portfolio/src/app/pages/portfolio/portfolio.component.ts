import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeroSection } from './sections/hero-section/hero-section';
import { AboutMe } from './sections/about-me/about-me';
import { Experience } from './sections/experience/experience';
import { ProjectsSection } from './sections/projects-section/projects-section';
import { ContactSection } from './sections/contact-section/contact-section';

@Component({
  selector: 'app-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroSection, AboutMe, Experience, ProjectsSection, ContactSection],
  template: `
    <app-hero-section />
    <app-about-me />
    <app-experience />
    <app-projects-section />
    <app-contact-section />
  `,
})
export class PortfolioComponent {}
