import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { PhosphorField } from './phosphor-field';

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: reduced,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe('PhosphorField', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a canvas element in the browser', async () => {
    mockMatchMedia(false);
    await TestBed.configureTestingModule({
      imports: [PhosphorField],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhosphorField);
    fixture.detectChanges();
    await fixture.whenStable();

    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('does nothing on the server platform', async () => {
    mockMatchMedia(false);
    await TestBed.configureTestingModule({
      imports: [PhosphorField],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhosphorField);
    fixture.detectChanges();
    await fixture.whenStable();

    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    // Untouched canvas keeps its HTML default size — the component never sized it.
    expect(canvas.width).toBe(300);
  });

  it('does not track pointer/scroll activity under prefers-reduced-motion', async () => {
    mockMatchMedia(true);
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    await TestBed.configureTestingModule({
      imports: [PhosphorField],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhosphorField);
    fixture.detectChanges();
    await fixture.whenStable();

    const callsAfterInit = rafSpy.mock.calls.length;

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    window.dispatchEvent(new Event('scroll'));

    expect(rafSpy.mock.calls.length).toBe(callsAfterInit);
  });
});
