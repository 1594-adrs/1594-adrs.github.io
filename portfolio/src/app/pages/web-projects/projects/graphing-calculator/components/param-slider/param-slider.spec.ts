import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SliderBounds } from '../../models/calculator.models';
import type { SliderSpec } from '../../state/param-sliders.state';
import { ParamSlider } from './param-slider';

@Component({
  imports: [ParamSlider],
  template: `<app-param-slider
    [spec]="spec()"
    (valueChange)="values.push($event)"
    (boundsChange)="onBounds($event)"
  />`,
})
class Host {
  spec = signal<SliderSpec>({ name: 'a', min: -10, max: 10, step: 0.1, value: 1 });
  values: number[] = [];
  /** Mimics setSliderBounds: rejects an inverted range. */
  onBounds(p: Partial<SliderBounds>) {
    const next = { ...this.spec(), ...p };
    if (Number.isFinite(next.min) && Number.isFinite(next.max) && next.min < next.max) {
      this.spec.set(next);
    }
  }
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  const q = (label: string) => el.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  return { fixture, host: fixture.componentInstance, q };
}

describe('ParamSlider', () => {
  it('has the four aria-labels', () => {
    const { q } = setup();
    for (const l of ['a value', 'a minimum', 'a maximum', 'a step']) expect(q(l)).toBeTruthy();
  });

  it('range input emits the numeric value', () => {
    const { q, host } = setup();
    const r = q('a value');
    r.value = '3.5';
    r.dispatchEvent(new Event('input'));
    expect(host.values).toEqual([3.5]);
  });

  it('commits a valid max', () => {
    const { q, host, fixture } = setup();
    const max = q('a maximum');
    max.value = '20';
    max.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.spec().max).toBe(20);
    expect(max.getAttribute('aria-invalid')).toBeNull();
  });

  it('reverts an invalid min and flags it', async () => {
    const { q, host, fixture } = setup();
    const min = q('a minimum');
    min.value = '50';
    min.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.spec().min).toBe(-10);
    expect(min.value).toBe('-10');
    expect(min.getAttribute('aria-invalid')).toBe('true');
  });
});
