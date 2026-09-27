import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { LoadingScreen } from './loading-screen';

describe('LoadingScreen', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    // Other specs stub matchMedia on the shared window; pin "no reduced motion" so order can't leak in.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    await TestBed.configureTestingModule({
      imports: [LoadingScreen],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have visible=true and fadingOut=false on first visit', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    expect(component.visible()).toBe(true);
    expect(component.fadingOut()).toBe(false);
  });

  it('should set fadingOut=true after 500ms', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.advanceTimersByTime(500);

    expect(component.fadingOut()).toBe(true);
    expect(component.visible()).toBe(true);
  });

  it('should set visible=false after 800ms total', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.advanceTimersByTime(800);

    expect(component.visible()).toBe(false);
  });

  it('should skip immediately on keydown', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown'));
    vi.advanceTimersByTime(0);
    expect(component.fadingOut()).toBe(true);

    vi.advanceTimersByTime(300);
    expect(component.visible()).toBe(false);
  });

  it('should set visible=false immediately when not in browser platform', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoadingScreen],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoadingScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.visible()).toBe(false);
  });

  it('should not show again on a second instantiation within the same session', () => {
    const first = TestBed.createComponent(LoadingScreen);
    first.detectChanges();
    expect(first.componentInstance.visible()).toBe(true);

    const second = TestBed.createComponent(LoadingScreen);
    second.detectChanges();
    expect(second.componentInstance.visible()).toBe(false);
  });

  it('should skip entirely when prefers-reduced-motion is set', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    const fixture = TestBed.createComponent(LoadingScreen);
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
