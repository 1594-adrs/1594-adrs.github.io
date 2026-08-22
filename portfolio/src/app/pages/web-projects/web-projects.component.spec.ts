import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WebProjectsComponent } from './web-projects.component';
import { WEB_PROJECTS } from '../../shared/data/portfolio.data';

describe('WebProjectsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebProjectsComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(WebProjectsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all web projects', () => {
    const fixture = TestBed.createComponent(WebProjectsComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.project-card');
    expect(cards.length).toBe(WEB_PROJECTS.length);
  });

  it('should render project titles', () => {
    const fixture = TestBed.createComponent(WebProjectsComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titles = compiled.querySelectorAll('.project-title');
    expect(titles[0]?.textContent).toContain(WEB_PROJECTS[0].title);
  });

  it('should have routerLink on open buttons', () => {
    const fixture = TestBed.createComponent(WebProjectsComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('.btn-open');
    expect(links.length).toBe(WEB_PROJECTS.length);
  });

  it('should render section title', () => {
    const fixture = TestBed.createComponent(WebProjectsComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.section-title');
    expect(title?.textContent).toContain('Web Projects');
  });
});
