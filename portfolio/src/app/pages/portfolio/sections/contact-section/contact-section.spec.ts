import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ContactSection } from './contact-section';
import { PROFILE } from '../../../../shared/data/portfolio.data';

describe('ContactSection', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactSection],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ContactSection);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the profile email as visible, copyable text', () => {
    const fixture = TestBed.createComponent(ContactSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.contact-email')?.textContent).toContain(PROFILE.email);
  });

  it('wraps contact details in an <address> element', () => {
    const fixture = TestBed.createComponent(ContactSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('address')).toBeTruthy();
  });

  it('renders the section with id="contact"', () => {
    const fixture = TestBed.createComponent(ContactSection);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('section#contact')).toBeTruthy();
  });
});
