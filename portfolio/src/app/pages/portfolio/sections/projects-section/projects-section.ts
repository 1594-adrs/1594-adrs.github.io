import { Component, ChangeDetectionStrategy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Project } from '../../../../shared/models/portfolio.models';
import { PROJECTS } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-projects-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-section.html',
  styleUrls: ['./projects-section.css'],
  imports: [RevealOnScroll],
})
export class ProjectsSection {
  projects: Project[] = PROJECTS;

  openGithub(url: string) {
    window.open(url, '_blank');
  }
}
