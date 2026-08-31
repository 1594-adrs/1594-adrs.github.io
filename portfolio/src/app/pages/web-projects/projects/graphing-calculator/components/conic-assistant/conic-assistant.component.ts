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
    const PI = Math.PI;
    switch (this.activeTab()) {
      case 'circle':
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Radius', value: `${p.a}` },
          { label: 'Area', value: `${(PI * p.a * p.a).toFixed(4)}` },
          { label: 'Circumference', value: `${(2 * PI * p.a).toFixed(4)}` },
          { label: 'Rev. Volume (x-axis)', value: `${((4 / 3) * PI * p.a * p.a * p.a).toFixed(4)}` },
          { label: 'Rev. Surface (x-axis)', value: `${(4 * PI * p.a * p.a).toFixed(4)}` },
        ];
      case 'ellipse': {
        const c = Math.sqrt(Math.abs(p.a * p.a - p.b * p.b));
        const ecc = p.a > p.b ? c / p.a : c / p.b;
        const rx = p.a;
        const ry = p.b;
        const revVol = (4 / 3) * PI * rx * ry * ry;
        let revSA: string;
        if (Math.abs(ecc) < 1e-10) {
          revSA = `${(4 * PI * rx * rx).toFixed(4)}`;
        } else if (rx > ry) {
          revSA = `${(2 * PI * ry * ry + 2 * PI * rx * ry / ecc * Math.asin(ecc)).toFixed(4)}`;
        } else {
          const e2 = Math.sqrt(1 - (rx * rx) / (ry * ry));
          revSA = `${(2 * PI * rx * rx + 2 * PI * ry * ry / e2 * Math.asin(e2)).toFixed(4)}`;
        }
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Semi-axes', value: `a=${p.a}, b=${p.b}` },
          { label: 'Focal dist (c)', value: `${c.toFixed(4)}` },
          { label: 'Eccentricity', value: `${ecc.toFixed(4)}` },
          { label: 'Area', value: `${(PI * p.a * p.b).toFixed(4)}` },
          { label: 'Rev. Volume (x-axis)', value: revVol.toFixed(4) },
          { label: 'Rev. Surface (x-axis)', value: revSA },
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
      case 'circle': {
        const D = -2 * h;
        const E = -2 * k;
        const F = h * h + k * k - p.a * p.a;
        let expr = 'x^2+y^2';
        if (D !== 0) expr += (D > 0 ? '+' : '') + D + '*x';
        if (E !== 0) expr += (E > 0 ? '+' : '') + E + '*y';
        if (F !== 0) expr += (F > 0 ? '+' : '') + F;
        return expr + '=0';
      }
      case 'ellipse': {
        const a2 = p.a * p.a;
        const b2 = p.b * p.b;
        const A = b2;
        const B = a2;
        const C = -2 * b2 * h;
        const D = -2 * a2 * k;
        const E = b2 * h * h + a2 * k * k - a2 * b2;
        let expr = A + '*x^2+' + B + '*y^2';
        if (C !== 0) expr += (C > 0 ? '+' : '') + C + '*x';
        if (D !== 0) expr += (D > 0 ? '+' : '') + D + '*y';
        if (E !== 0) expr += (E > 0 ? '+' : '') + E;
        return expr + '=0';
      }
      case 'parabola':
        if (p.orientation === 'vertical') {
          return `(x${h !== 0 ? '-' + h : ''})^2=${4 * p.p}*(y${k !== 0 ? '-' + k : ''})`;
        }
        return `(y${k !== 0 ? '-' + k : ''})^2=${4 * p.p}*(x${h !== 0 ? '-' + h : ''})`;
      case 'hyperbola': {
        const a2 = p.a * p.a;
        const b2 = p.b * p.b;
        const A = b2;
        const B = -a2;
        const C = -2 * b2 * h;
        const D = 2 * a2 * k;
        const E = b2 * h * h - a2 * k * k - a2 * b2;
        let expr = A + '*x^2' + (B > 0 ? '+' : '') + B + '*y^2';
        if (C !== 0) expr += (C > 0 ? '+' : '') + C + '*x';
        if (D !== 0) expr += (D > 0 ? '+' : '') + D + '*y';
        if (E !== 0) expr += (E > 0 ? '+' : '') + E;
        return expr + '=0';
      }
    }
  });

  onAddGraph(): void {
    this.addGraph.emit(this.implicitExpression());
  }

  onClose(): void {
    this.close.emit();
  }
}
