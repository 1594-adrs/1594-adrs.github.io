import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
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
export class PortfolioComponent implements OnInit {
  private titleService = inject(Title);

  ngOnInit(): void {
    this.titleService.setTitle('Andres Rincon — Full Stack Developer');
  }
}
