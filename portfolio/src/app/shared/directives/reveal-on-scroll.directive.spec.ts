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
    vi.unstubAllGlobals();
  });

  it('should create', async () => {
    await TestBed.configureTestingModule({ imports: [RevealHost] }).compileComponents();
    const fixture = TestBed.createComponent(RevealHost);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should reveal once and unobserve on the first intersection, and stay revealed on exit', async () => {
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
    expect(unobserveSpy).toHaveBeenCalled();
    expect(disconnectSpy).toHaveBeenCalled();

    capturedCallback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
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
