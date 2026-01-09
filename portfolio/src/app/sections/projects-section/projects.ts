import { Component, signal, PLATFORM_ID, Inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  githubUrl: string;
  imageUrl?: string;
  liveUrl?: string;
  featured?: boolean;
}

@Component({
  selector: 'app-projects-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects-section.html',
  styleUrls: ['./projects-section.css']
})
export class ProjectsSection implements AfterViewInit {
  @ViewChild('projectsSection') projectsSection!: ElementRef;

  private isBrowser: boolean;
  projectsRevealed = signal(false);

  // Array de proyectos - personaliza con tus proyectos
  projects: Project[] = [
    {
      id: '1',
      title: 'Portfolio Personal',
      description: 'Modern personal portfolio website built with Angular and TypeScript. Features smooth animations, scroll-reveal effects, responsive design, and reusable components with clean architecture.',
      technologies: ['Angular', 'TypeScript', 'CSS', 'HTML', 'RxJS'],
      githubUrl: 'https://github.com/1594-adrs/1594-adrs.github.io',
      featured: true
    },
    {
      id: '2',
      title: 'RacketChess',
      description: 'A fully functional chess game implemented in pure Racket demonstrating the power of functional programming without imperative loops. Features complete move validation, check/checkmate detection, and an interactive graphical interface using recursion-based algorithms.',
      technologies: ['Racket', 'Lisp', 'Functional Programming', 'Graphics Library', 'Game Logic'],
      githubUrl: 'https://github.com/1594-adrs/RacketChess',
      featured: true
    },
    {
      id: '3',
      title: 'Discord Bots Automation',
      description: 'Automated command execution tool for Discord with human-like behavior simulation. Implements realistic timing patterns, typing indicators, and break intervals. Built with advanced error handling and customizable execution strategies.',
      technologies: ['Python', 'discord.py', 'Async/Await', 'Automation', 'API Integration'],
      githubUrl: 'https://github.com/1594-adrs/discord-bots-automation',
      featured: true
    }
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

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
        rootMargin: '0px'
      }
    );

    if (this.projectsSection) {
      observer.observe(this.projectsSection.nativeElement);
    }
  }

  openGithub(url: string) {
    window.open(url, '_blank');
  }
}
