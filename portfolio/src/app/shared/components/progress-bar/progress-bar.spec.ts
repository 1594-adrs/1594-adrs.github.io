import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBar],
    }).compileComponents();
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
});
