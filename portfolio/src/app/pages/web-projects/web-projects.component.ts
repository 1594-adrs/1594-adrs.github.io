import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { WebProject } from '../../shared/models/portfolio.models';
import { WEB_PROJECTS } from '../../shared/data/portfolio.data';
import { IconComponent } from '../../shared/icons/icon.component';

@Component({
  selector: 'app-web-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './web-projects.component.html',
  styleUrls: ['./web-projects.component.css', './web-projects-cards.css'],
})
export class WebProjectsComponent implements OnInit {
  private titleService = inject(Title);

  projects: WebProject[] = WEB_PROJECTS;

  ngOnInit(): void {
    this.titleService.setTitle('Web Projects — Andres Rincon');
  }
}
