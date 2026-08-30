import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GraphingCalculatorComponent } from './graphing-calculator.component';

describe('GraphingCalculatorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphingCalculatorComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have one default function', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    expect(fixture.componentInstance.functions().length).toBe(1);
  });

  it('should add a function', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    comp.addFunction();
    expect(comp.functions().length).toBe(2);
  });

  it('should not exceed 5 functions', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    for (let i = 0; i < 5; i++) comp.addFunction();
    expect(comp.functions().length).toBe(5);
    comp.addFunction();
    expect(comp.functions().length).toBe(5);
  });

  it('should remove a function', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    comp.addFunction();
    expect(comp.functions().length).toBe(2);
    comp.removeFunction(0);
    expect(comp.functions().length).toBe(1);
  });

  it('should toggle visibility', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.functions()[0].visible).toBe(true);
    comp.toggleVisibility(0);
    expect(comp.functions()[0].visible).toBe(false);
  });

  it('should activate integral mode', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.activeIntegral()).toBeNull();
    comp.activateIntegral();
    expect(comp.activeIntegral()).not.toBeNull();
  });

  it('should activate solid mode', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.activeSolid()).toBeNull();
    comp.activateSolid();
    expect(comp.activeSolid()).not.toBeNull();
  });

  it('should render canvas element', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('canvas')).toBeTruthy();
  });

  it('should render sidebar', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.sidebar')).toBeTruthy();
  });
});
