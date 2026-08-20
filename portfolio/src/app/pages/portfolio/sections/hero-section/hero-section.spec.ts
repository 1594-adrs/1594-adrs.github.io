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
    expect(compiled.querySelector('.role')?.textContent).toContain('Full Stack Developer');
  });
});
