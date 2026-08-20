import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Navbar } from './shared/components/navbar/navbar';
import { ProgressBar } from './shared/components/progress-bar/progress-bar';
import { SocialButtons } from './shared/components/social-buttons/social-buttons';
import { HeroSection } from './pages/main/sections/hero-section/hero-section';
import { AboutMe } from './pages/main/sections/about-me/about-me';
import { ProjectsSection } from './pages/main/sections/projects-section/projects-section';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Navbar, ProgressBar, SocialButtons, HeroSection, AboutMe, ProjectsSection],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent {}
