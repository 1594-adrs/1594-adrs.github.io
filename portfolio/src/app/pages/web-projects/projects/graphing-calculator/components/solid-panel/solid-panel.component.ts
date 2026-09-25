import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { IntegralFormulaComponent } from '../integral-formula/integral-formula.component';
import { SolidToolState } from '../../state/solid-tool.state';
import type { CrossSectionShape, SolidMethod } from '../../engine/solids/solid.types';

const METHOD_GUIDANCE: Record<SolidMethod, string> = {
  'disk-washer':
    'Slices perpendicular to the axis. Use when the axis is parallel to the variable (y = k with f(x)).',
  shell:
    'Cylindrical shells parallel to the axis. Use when the axis is perpendicular to the variable (x = k with f(x)).',
  'cross-section': 'Known shapes standing on the region. V = ∫ A(x) dx.',
};

const SHAPE_LABELS: Record<CrossSectionShape, string> = {
  square: 'Square',
  rectangle: 'Rectangle',
  'equilateral-triangle': 'Equilateral triangle',
  'right-isosceles-leg': 'Right isosceles (leg on base)',
  'right-isosceles-hypotenuse': 'Right isosceles (hypotenuse on base)',
  semicircle: 'Semicircle',
};

function formatValue(v: number): string {
  if (Number.isNaN(v)) return 'undefined';
  if (Math.abs(v) < 1e-10) return '0';
  if (Math.abs(v) >= 1e12 || Math.abs(v) < 0.001) return v.toExponential(3);
  return v.toFixed(6);
}

/**
 * Tool panel for "solids by integration": method selection, curve/bounds/axis inputs, inline
 * validation, the volume result, and the sweep (Play/Pause/Reset) controls. Reads/writes
 * everything through the injected SolidToolState (provided by the calculator component).
 */
@Component({
  selector: 'app-solid-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IntegralFormulaComponent],
  templateUrl: './solid-panel.component.html',
  styleUrl: './solid-panel.component.css',
})
export class SolidPanelComponent {
  state = inject(SolidToolState);

  methods: SolidMethod[] = ['disk-washer', 'shell', 'cross-section'];
  shapes: CrossSectionShape[] = [
    'square',
    'rectangle',
    'equilateral-triangle',
    'right-isosceles-leg',
    'right-isosceles-hypotenuse',
    'semicircle',
  ];

  methodGuidance(method: SolidMethod): string {
    return METHOD_GUIDANCE[method];
  }

  shapeLabel(shape: CrossSectionShape): string {
    return SHAPE_LABELS[shape];
  }

  formatVolume(v: number): string {
    return formatValue(v);
  }

  axisPrefix(): string {
    return this.state.axisOrientation() === 'horizontal' ? 'y =' : 'x =';
  }

  sweepValueText(): string {
    const t = this.state.sweepT();
    const variable = this.state.variable();
    const area = this.state.sweepArea();
    if (t === null) return 'not set';
    const areaText = area === null ? 'undefined' : formatValue(area);
    return `${variable} = ${formatValue(t)}, A = ${areaText}`;
  }

  onSweepInput(value: string): void {
    const num = parseFloat(value);
    if (!Number.isNaN(num)) this.state.setSweepT(num);
  }

  togglePlay(): void {
    if (this.state.playing()) this.state.pause();
    else this.state.play();
  }
}
