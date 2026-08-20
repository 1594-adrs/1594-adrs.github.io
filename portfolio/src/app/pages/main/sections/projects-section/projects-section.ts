import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { Project } from '../../../../shared/models/portfolio.models';
import { projects } from '../../../../shared/data/portfolio.data';

@Component({
  selector: 'app-projects-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-section.html',
  styleUrls: ['./projects-section.css'],
})
export class ProjectsSection {
  projectsRevealed = signal(false);

  projects: Project[] = projects;

  onReveal() {
    this.projectsRevealed.set(true);
  }

  openGithub(url: string) {
    window.open(url, '_blank');
  }
}
