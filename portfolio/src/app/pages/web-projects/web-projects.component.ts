import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WebProject } from '../../shared/models/portfolio.models';
import { WEB_PROJECTS } from '../../shared/data/portfolio.data';

@Component({
  selector: 'app-web-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './web-projects.component.html',
  styleUrls: ['./web-projects.component.css', './web-projects-cards.css'],
})
export class WebProjectsComponent {
  projects: WebProject[] = WEB_PROJECTS;
}
