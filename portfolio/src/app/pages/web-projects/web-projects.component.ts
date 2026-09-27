import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WebProject } from '../../shared/models/portfolio.models';
import { WEB_PROJECTS } from '../../shared/data/portfolio.data';
import { IconComponent } from '../../shared/icons/icon.component';

@Component({
  selector: 'app-web-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './web-projects.component.html',
  styleUrls: ['./web-projects.component.css'],
})
export class WebProjectsComponent {
  projects: WebProject[] = WEB_PROJECTS;
}
