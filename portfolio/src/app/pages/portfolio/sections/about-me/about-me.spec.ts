import { TestBed } from '@angular/core/testing';
import { AboutMe } from './about-me';

describe('AboutMe', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutMe],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AboutMe);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render name', () => {
    const fixture = TestBed.createComponent(AboutMe);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.name')?.textContent).toContain('Andrés David Rincón');
  });

  it('should render skill categories', () => {
    const fixture = TestBed.createComponent(AboutMe);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.skill-category').length).toBe(4);
  });
});
