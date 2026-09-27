import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ContactSection } from './contact-section';
import { PROFILE, EMAIL_COMPOSE_URL } from '../../../../shared/data/portfolio.data';

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

  it('primary CTA opens Gmail compose in a new tab, addressed to the profile email', () => {
    const fixture = TestBed.createComponent(ContactSection);
    fixture.detectChanges();
    const cta = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.btn-primary')!;
    expect(cta.getAttribute('href')).toBe(EMAIL_COMPOSE_URL);
    expect(EMAIL_COMPOSE_URL).toContain('mail.google.com');
    expect(EMAIL_COMPOSE_URL).toContain(encodeURIComponent(PROFILE.email));
    expect(cta.getAttribute('target')).toBe('_blank');
  });

  it('keeps a mailto: fallback link for visitors with a mail app', () => {
    const fixture = TestBed.createComponent(ContactSection);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('.contact-mailapp a');
    expect(link?.getAttribute('href')).toBe('mailto:' + PROFILE.email);
  });

  it('copies the email to the clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const fixture = TestBed.createComponent(ContactSection);
    fixture.detectChanges();
    await fixture.componentInstance.copyEmail();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith(PROFILE.email);
    expect(fixture.componentInstance.copied()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Copied!');
  });
});
