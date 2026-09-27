import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HeroSection } from './hero-section';

describe('HeroSection', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSection],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HeroSection);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render name and role', () => {
    const fixture = TestBed.createComponent(HeroSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.name')?.textContent).toContain('Andrés Rincón');
    expect(compiled.querySelector('.role')?.textContent).toContain('Software Developer');
  });

  it('should render the ASCII monogram hidden from assistive tech', () => {
    const fixture = TestBed.createComponent(HeroSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const pre = compiled.querySelector('.monogram');
    expect(pre).not.toBeNull();
    expect(pre?.getAttribute('aria-hidden')).toBe('true');
    expect(pre?.textContent).toContain('█');
  });

  it('should expose the plain name once as the accessible name, despite the glitch pseudo-elements', () => {
    const fixture = TestBed.createComponent(HeroSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const h1 = compiled.querySelector('h1.name');
    expect(h1?.getAttribute('aria-label')).toBe('Andrés Rincón');
  });

  it('should render the availability line', () => {
    const fixture = TestBed.createComponent(HeroSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.availability')?.textContent).toContain('Open to');
  });
});
