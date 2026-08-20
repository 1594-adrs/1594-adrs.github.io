import { Component, signal, ChangeDetectionStrategy, PLATFORM_ID, inject, AfterViewInit, ElementRef, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface SkillCategory {
  title: string;
  icon: string;
  skills: string[];
}

interface Course {
  name: string;
  issuer: string;
}

@Component({
  selector: 'app-about-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about-me.html',
  styleUrls: ['./about-me.css'],
})
export class AboutMe implements AfterViewInit {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private aboutSection = viewChild.required<ElementRef>('aboutSection');

  sectionRevealed = signal(false);

  name = 'Andrés David Rincón Salazar';
  title = 'Software Developer';
  level = 'Mid-Level';

  description = `Dedicated developer with solid knowledge in programming logic and multiple programming languages. Computer Science and Systems Engineering student with proven ability to learn quickly and deliver clean, efficient code. Bilingual (Spanish/English) with certifications in AI and Python development. Passionate about creating innovative technological solutions, scalable software development, and implementing best practices in every project.`;

  skills: SkillCategory[] = [
    {
      title: 'Advanced',
      icon: 'fas fa-code',
      skills: ['Python', 'C', 'Racket'],
    },
    {
      title: 'Functional',
      icon: 'fas fa-laptop-code',
      skills: ['Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'LUA'],
    },
    {
      title: 'Databases',
      icon: 'fas fa-database',
      skills: ['SQL'],
    },
    {
      title: 'Infrastructure',
      icon: 'fas fa-cloud',
      skills: ['Git', 'GitHub', 'AWS', 'Azure', 'Google Cloud'],
    },
  ];

  courses: Course[] = [
    { name: 'Python Developer', issuer: 'Certification' },
    { name: 'Generative AI Usage', issuer: 'Certification' },
    { name: 'Prompt Engineering', issuer: 'Certification' },
    { name: 'Data Analysis with AI', issuer: 'Certification' },
    { name: 'Professional Ethics', issuer: 'Certification' },
    { name: 'Interpersonal Skills Development', issuer: 'Certification' },
  ];

  education = [
    {
      degree: 'Computer Science and Systems Engineering',
      institution: 'Universidad Tecnológica De Pereira',
      period: '2025 - Present (Expected graduation 2029)',
      detail: 'Active member of the competitive programming workshop',
    },
    {
      degree: 'Systems Technician',
      institution: 'SENA',
      period: '2023 - 2024',
      detail: 'Participant and winner of "Tecnoferia 2024: S.O.S-Tenibilidad"',
    },
  ];

  softSkills = [
    'Bilingual: Spanish (Native), English (Advanced - B2 Level)',
    'Experience in collaboration and effective communication',
    'Analytical and creative approach to overcome technical challenges',
    'Commitment to code quality and precision',
    'Flexibility to work with different technologies and methodologies',
    'Constant motivation for autonomous learning',
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
            this.sectionRevealed.set(true);
          }
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(this.aboutSection().nativeElement);
  }
}
