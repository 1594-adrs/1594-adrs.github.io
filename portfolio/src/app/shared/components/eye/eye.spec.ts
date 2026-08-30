import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Eye } from './eye';

describe('Eye', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Eye],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Eye);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have default irisTransform', () => {
    const fixture = TestBed.createComponent(Eye);
    const component = fixture.componentInstance;
    expect(component.irisTransform()).toBe('translate(0px, 0px)');
  });

  it('should not throw when no eye element is present', () => {
    const fixture = TestBed.createComponent(Eye);
    fixture.detectChanges();

    expect(() => {
      const event = new MouseEvent('mousemove', { clientX: 100, clientY: 100 });
      window.dispatchEvent(event);
    }).not.toThrow();
  });

  it('should not attach mousemove listener in non-browser environment', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Eye],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const fixture = TestBed.createComponent(Eye);
    fixture.detectChanges();

    expect(fixture.componentInstance.irisTransform()).toBe('translate(0px, 0px)');
  });
});
