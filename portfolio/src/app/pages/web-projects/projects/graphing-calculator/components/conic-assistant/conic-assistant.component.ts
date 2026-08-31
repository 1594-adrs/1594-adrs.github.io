import {
  Component,
  ChangeDetectionStrategy,
  signal,
  output,
  computed,
} from '@angular/core';
import type { ConicType } from '../../models/calculator.models';

interface ConicParams {
  h: number;
  k: number;
  a: number;
  b: number;
  p: number;
  orientation: 'horizontal' | 'vertical';
}

@Component({
  selector: 'app-conic-assistant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conic-assistant.component.html',
  styleUrls: ['./conic-assistant.component.css'],
})
export class ConicAssistantComponent {
  addGraph = output<string>();
  close = output<void>();

  activeTab = signal<ConicType>('circle');

  params = signal<ConicParams>({
    h: 0,
    k: 0,
    a: 2,
    b: 1,
    p: 1,
    orientation: 'vertical',
  });

  tabs: { key: ConicType; label: string }[] = [
    { key: 'circle', label: 'Circle' },
    { key: 'ellipse', label: 'Ellipse' },
    { key: 'parabola', label: 'Parabola' },
    { key: 'hyperbola', label: 'Hyperbola' },
  ];

  setTab(tab: ConicType): void {
    this.activeTab.set(tab);
  }

  updateParamH(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.params.update((p) => ({ ...p, h: v }));
  }
  updateParamK(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.params.update((p) => ({ ...p, k: v }));
  }
  updateParamA(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) this.params.update((p) => ({ ...p, a: v }));
  }
  updateParamB(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) this.params.update((p) => ({ ...p, b: v }));
  }
  updateParamP(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.params.update((p) => ({ ...p, p: v }));
  }
  updateOrientation(e: Event): void {
    const v = (e.target as HTMLSelectElement).value as 'horizontal' | 'vertical';
    this.params.update((p) => ({ ...p, orientation: v }));
  }

  equation = computed(() => {
    const p = this.params();
    const h = p.h;
    const k = p.k;
    switch (this.activeTab()) {
      case 'circle':
        return `(x${h !== 0 ? ' - ' + h : ''})² + (y${k !== 0 ? ' - ' + k : ''})² = ${p.a}²`;
      case 'ellipse':
        return `(x${h !== 0 ? ' - ' + h : ''})²/${p.a}² + (y${k !== 0 ? ' - ' + k : ''})²/${p.b}² = 1`;
      case 'parabola':
        if (p.orientation === 'vertical') {
          return `(x${h !== 0 ? ' - ' + h : ''})² = ${4 * p.p}(y${k !== 0 ? ' - ' + k : ''})`;
        }
        return `(y${k !== 0 ? ' - ' + k : ''})² = ${4 * p.p}(x${h !== 0 ? ' - ' + h : ''})`;
      case 'hyperbola':
        return `(x${h !== 0 ? ' - ' + h : ''})²/${p.a}² - (y${k !== 0 ? ' - ' + k : ''})²/${p.b}² = 1`;
    }
  });

  properties = computed(() => {
    const p = this.params();
    const h = p.h;
    const k = p.k;
    switch (this.activeTab()) {
      case 'circle':
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Radius', value: `${p.a}` },
          { label: 'Area', value: `${(Math.PI * p.a * p.a).toFixed(4)}` },
          { label: 'Circumference', value: `${(2 * Math.PI * p.a).toFixed(4)}` },
        ];
      case 'ellipse': {
        const c = Math.sqrt(Math.abs(p.a * p.a - p.b * p.b));
        const ecc = p.a > p.b ? c / p.a : c / p.b;
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Semi-axes', value: `a=${p.a}, b=${p.b}` },
          { label: 'Focal dist (c)', value: `${c.toFixed(4)}` },
          { label: 'Eccentricity', value: `${ecc.toFixed(4)}` },
          { label: 'Area', value: `${(Math.PI * p.a * p.b).toFixed(4)}` },
        ];
      }
      case 'parabola':
        return [
          { label: 'Vertex', value: `(${h}, ${k})` },
          { label: 'Focal length', value: `${p.p}` },
          { label: 'Focus', value: p.orientation === 'vertical' ? `(${h}, ${k + p.p})` : `(${h + p.p}, ${k})` },
          { label: 'Directrix', value: p.orientation === 'vertical' ? `y = ${k - p.p}` : `x = ${h - p.p}` },
        ];
      case 'hyperbola': {
        const c = Math.sqrt(p.a * p.a + p.b * p.b);
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Semi-axes', value: `a=${p.a}, b=${p.b}` },
          { label: 'Focal dist (c)', value: `${c.toFixed(4)}` },
          { label: 'Eccentricity', value: `${(c / p.a).toFixed(4)}` },
          { label: 'Asymptotes', value: `y = ±(${p.b}/${p.a})(x${h !== 0 ? ' - ' + h : ''})${k !== 0 ? ' + ' + k : ''}` },
        ];
      }
    }
  });

  implicitExpression = computed(() => {
    const p = this.params();
    const h = p.h;
    const k = p.k;
    switch (this.activeTab()) {
      case 'circle':
        return `(x${h !== 0 ? '-' + h : ''})^2+(y${k !== 0 ? '-' + k : ''})^2=${p.a}^2`;
      case 'ellipse':
        return `(x${h !== 0 ? '-' + h : ''})^2/${p.a}^2+(y${k !== 0 ? '-' + k : ''})^2/${p.b}^2=1`;
      case 'parabola':
        if (p.orientation === 'vertical') {
          return `(x${h !== 0 ? '-' + h : ''})^2=${4 * p.p}*(y${k !== 0 ? '-' + k : ''})`;
        }
        return `(y${k !== 0 ? '-' + k : ''})^2=${4 * p.p}*(x${h !== 0 ? '-' + h : ''})`;
      case 'hyperbola':
        return `(x${h !== 0 ? '-' + h : ''})^2/${p.a}^2-(y${k !== 0 ? '-' + k : ''})^2/${p.b}^2=1`;
    }
  });

  onAddGraph(): void {
    this.addGraph.emit(this.implicitExpression());
  }

  onClose(): void {
    this.close.emit();
  }
}
