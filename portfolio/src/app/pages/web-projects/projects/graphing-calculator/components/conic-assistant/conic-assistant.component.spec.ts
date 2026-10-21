import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ConicAssistantComponent, ellipseRevolutionSurface } from './conic-assistant.component';

// Reference values: 2π∫₀^π ry·sin t·√(rx²sin²t + ry²cos²t) dt by composite Simpson (n = 20000).
describe('ellipseRevolutionSurface (about the x-axis)', () => {
  it.each([
    [1, 2, 34.68753081338027], // oblate (was 36.6737)
    [1, 3, 68.29618678035457],
    [2, 1, 21.478435327883616], // prolate
    [3, 1, 30.89372397508865],
    [1.5, 1.5, 28.27433388230818], // sphere
  ])('rx=%d, ry=%d → %d', (rx, ry, expected) => {
    expect(ellipseRevolutionSurface(rx, ry)).toBeCloseTo(expected, 9);
  });
});

describe('ConicAssistantComponent numeric fields', () => {
  it('resets a rejected value to the last accepted one', () => {
    const comp = TestBed.runInInjectionContext(() => new ConicAssistantComponent());
    comp.updateParamA({ target: { value: '3' } } as unknown as Event);
    const input = { value: '-2' };
    comp.updateParamA({ target: input } as unknown as Event);
    expect(comp.params().a).toBe(3);
    expect(input.value).toBe('3');
  });
});
