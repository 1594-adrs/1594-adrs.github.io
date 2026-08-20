import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeroSection } from '../main/sections/hero-section/hero-section';
import { AboutMe } from '../main/sections/about-me/about-me';
import { ProjectsSection } from '../main/sections/projects-section/projects-section';

@Component({
  selector: 'app-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroSection, AboutMe, ProjectsSection],
  templateUrl: './portfolio.html',
})
export class PortfolioComponent {}
