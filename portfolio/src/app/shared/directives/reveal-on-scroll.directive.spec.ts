import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RevealOnScroll } from './reveal-on-scroll.directive';

@Component({
  selector: 'app-reveal-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll],
  template: `<div appRevealOnScroll #reveal="reveal"></div>`,
})
class RevealHost {}

describe('RevealOnScroll', () => {
  let observeSpy: ReturnType<typeof vi.fn>;
  let unobserveSpy: ReturnType<typeof vi.fn>;
  let disconnectSpy: ReturnType<typeof vi.fn>;
  let capturedCallback: IntersectionObserverCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    observeSpy = vi.fn();
    unobserveSpy = vi.fn();
    disconnectSpy = vi.fn();

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (this: unknown, callback: IntersectionObserverCallback) {
        capturedCallback = callback;
        return {
          observe: observeSpy,
          unobserve: unobserveSpy,
          disconnect: disconnectSpy,
        };
      }),
    );
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('js-reveal');
  });

  it('should create', async () => {
    await TestBed.configureTestingModule({ imports: [RevealHost] }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should reveal on enter, glitch-hide on leave, and replay on re-entry', async () => {
    await TestBed.configureTestingModule({ imports: [RevealHost] }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();
    const directive = fixture.debugElement.children[0].injector.get(RevealOnScroll);

    expect(directive.revealed()).toBe(false);
    expect(observeSpy).toHaveBeenCalled();

    capturedCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(directive.revealed()).toBe(true);
    expect(unobserveSpy).not.toHaveBeenCalled();

    capturedCallback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(directive.hiding()).toBe(true);
    expect(directive.revealed()).toBe(true);

    vi.advanceTimersByTime(400);
    expect(directive.hiding()).toBe(false);
    expect(directive.revealed()).toBe(false);

    capturedCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(directive.revealed()).toBe(true);
    expect(directive.hiding()).toBe(false);
  });

  it('should reveal immediately without observing when reduced motion is preferred', async () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true });

    await TestBed.configureTestingModule({ imports: [RevealHost] }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();
    const directive = fixture.debugElement.children[0].injector.get(RevealOnScroll);

    expect(directive.revealed()).toBe(true);
    expect(observeSpy).not.toHaveBeenCalled();
  });

  it('should reveal immediately when IntersectionObserver is unavailable', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    await TestBed.configureTestingModule({ imports: [RevealHost] }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();
    const directive = fixture.debugElement.children[0].injector.get(RevealOnScroll);

    expect(directive.revealed()).toBe(true);
  });

  it('should mark the document root with js-reveal so CSS only hides content when JS runs', async () => {
    await TestBed.configureTestingModule({ imports: [RevealHost] }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();

    expect(document.documentElement.classList.contains('js-reveal')).toBe(true);
  });

  it('should not mark the document root when not in browser platform', async () => {
    await TestBed.configureTestingModule({
      imports: [RevealHost],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();

    expect(document.documentElement.classList.contains('js-reveal')).toBe(false);
  });

  it('should not observe when not in browser platform', async () => {
    await TestBed.configureTestingModule({
      imports: [RevealHost],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();

    expect(observeSpy).not.toHaveBeenCalled();
  });
});
