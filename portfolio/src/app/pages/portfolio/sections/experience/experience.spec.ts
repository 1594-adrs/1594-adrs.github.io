import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Experience } from './experience';
import { EXPERIENCE } from '../../../../shared/data/portfolio.data';

describe('Experience', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Experience],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Experience);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all experience items', () => {
    const fixture = TestBed.createComponent(Experience);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.timeline-item').length).toBe(EXPERIENCE.length);
  });

  it('should render the link with safe attributes for the item that has one', () => {
    const fixture = TestBed.createComponent(Experience);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector<HTMLAnchorElement>('.item-link');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('href')).toBe('https://af-autoservice.vercel.app/');
  });
});
