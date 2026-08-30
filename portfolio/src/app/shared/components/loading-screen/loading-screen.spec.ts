import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { LoadingScreen } from './loading-screen';

describe('LoadingScreen', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [LoadingScreen],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have visible=true and fadingOut=false initially', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    expect(component.visible()).toBe(true);
    expect(component.fadingOut()).toBe(false);
  });

  it('should set fadingOut=true after 1800ms', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.advanceTimersByTime(1800);

    expect(component.fadingOut()).toBe(true);
    expect(component.visible()).toBe(true);
  });

  it('should set visible=false after 2400ms (1800+600)', () => {
    const fixture = TestBed.createComponent(LoadingScreen);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.advanceTimersByTime(2400);

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
});
