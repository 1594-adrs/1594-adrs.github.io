import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProjectsSection } from './projects-section';
import { PROJECTS } from '../../../../shared/data/portfolio.data';

describe('ProjectsSection', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsSection],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProjectsSection);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all projects', () => {
    const fixture = TestBed.createComponent(ProjectsSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.project-card').length).toBe(PROJECTS.length + 1);
  });

  it('should render the featured web-projects card first, then data-driven projects', () => {
    const fixture = TestBed.createComponent(ProjectsSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titles = compiled.querySelectorAll('.project-title');
    expect(titles[0]?.textContent).toContain('Graphing Calculator');
    expect(titles[1]?.textContent).toContain(PROJECTS[0].title);
  });
});
