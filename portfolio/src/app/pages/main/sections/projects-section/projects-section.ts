import {
  Component,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Project } from '../../../../shared/models/portfolio.models';

@Component({
  selector: 'app-projects-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-section.html',
  styleUrls: ['./projects-section.css'],
})
export class ProjectsSection implements AfterViewInit {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private projectsSection = viewChild.required<ElementRef>('projectsSection');

  projectsRevealed = signal(false);

  projects: Project[] = [
    {
      id: '1',
      title: 'Portfolio Personal',
      description:
        'Modern personal portfolio website built with Angular and TypeScript. Features smooth animations, scroll-reveal effects, responsive design, and reusable components with clean architecture.',
      technologies: ['Angular', 'TypeScript', 'CSS', 'HTML', 'RxJS'],
      githubUrl: 'https://github.com/1594-adrs/1594-adrs.github.io',
      featured: true,
    },
    {
      id: '2',
      title: 'RacketChess',
      description:
        'A fully functional chess game implemented in pure Racket demonstrating the power of functional programming without imperative loops. Features complete move validation, check/checkmate detection, and an interactive graphical interface using recursion-based algorithms.',
      technologies: ['Racket', 'Lisp', 'Functional Programming', 'Graphics Library', 'Game Logic'],
      githubUrl: 'https://github.com/1594-adrs/RacketChess',
      featured: true,
    },
    {
      id: '3',
      title: 'Discord Bots Automation',
      description:
        'Automated command execution tool for Discord with human-like behavior simulation. Implements realistic timing patterns, typing indicators, and break intervals. Built with advanced error handling and customizable execution strategies.',
      technologies: ['Python', 'discord.py', 'Async/Await', 'Automation', 'API Integration'],
      githubUrl: 'https://github.com/1594-adrs/discord-bots-automation',
      featured: true,
    },
  ];

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.setupIntersectionObserver();
    }
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.projectsRevealed.set(true);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px',
      },
    );

    observer.observe(this.projectsSection().nativeElement);
  }

  openGithub(url: string) {
    window.open(url, '_blank');
  }
}
