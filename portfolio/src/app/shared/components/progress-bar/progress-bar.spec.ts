import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    await TestBed.configureTestingModule({
      imports: [ProgressBar],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProgressBar);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have scrollProgress=0 initially', () => {
    const fixture = TestBed.createComponent(ProgressBar);
    const component = fixture.componentInstance;
    expect(component.scrollProgress()).toBe(0);
  });

  it('should not attach scroll listener in non-browser environment', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProgressBar],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProgressBar);
    fixture.detectChanges();

    expect(fixture.componentInstance.scrollProgress()).toBe(0);
  });

  it('should update aria-valuenow when the page scrolls', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });

    const fixture = TestBed.createComponent(ProgressBar);
    fixture.detectChanges();

    window.dispatchEvent(new Event('scroll'));

    expect(fixture.componentInstance.roundedProgress()).toBe(50);

    const container: HTMLElement = fixture.nativeElement.querySelector('[role="scrollbar"]');
    expect(container.getAttribute('aria-valuenow')).toBe('50');

    vi.unstubAllGlobals();
  });

  it('should scroll to the bottom of the page when End is pressed', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 1000,
    });
    const scrollToSpy = vi.fn();
    vi.stubGlobal('scrollTo', scrollToSpy);

    const fixture = TestBed.createComponent(ProgressBar);
    fixture.detectChanges();

    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'End' }));

    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 1000, behavior: 'smooth' }),
    );

    vi.unstubAllGlobals();
  });

  it('should scroll to the matching section when a marker is clicked', () => {
    const section = document.createElement('div');
    section.id = 'about';
    document.body.appendChild(section);
    const scrollIntoViewSpy = vi.fn();
    section.scrollIntoView = scrollIntoViewSpy;

    const fixture = TestBed.createComponent(ProgressBar);
    fixture.detectChanges();

    const event = new Event('click');
    fixture.componentInstance.onMarkerClick(event, 'about');

    expect(scrollIntoViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start', behavior: 'smooth' }),
    );

    document.body.removeChild(section);
  });
});
