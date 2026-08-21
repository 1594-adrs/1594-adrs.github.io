import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Project } from '../../../../shared/models/portfolio.models';
import { PROJECTS } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-projects-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-section.html',
  styleUrls: ['./projects-section.css'],
  imports: [RevealOnScroll, LowerCasePipe, RouterLink],
})
export class ProjectsSection {
  projects: Project[] = PROJECTS;
}
