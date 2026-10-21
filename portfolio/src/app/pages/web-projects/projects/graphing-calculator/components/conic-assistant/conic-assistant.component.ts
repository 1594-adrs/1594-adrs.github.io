import { Component, ChangeDetectionStrategy, signal, output, computed } from '@angular/core';
import type { ConicType } from '../../models/calculator.models';

interface ConicParams {
  h: number;
  k: number;
  a: number;
  b: number;
  p: number;
  orientation: 'horizontal' | 'vertical';
}

/** Surface of the ellipsoid made by revolving x²/rx² + y²/ry² = 1 about the x-axis. */
export function ellipseRevolutionSurface(rx: number, ry: number): number {
  const PI = Math.PI;
  if (Math.abs(rx - ry) < 1e-10 * Math.max(rx, ry)) return 4 * PI * rx * rx;
  if (rx > ry) {
    const e = Math.sqrt(1 - (ry * ry) / (rx * rx));
    return 2 * PI * ry * ry + ((2 * PI * rx * ry) / e) * Math.asin(e);
  }
  // oblate: ln((1+e)/(1-e)) = 2·atanh(e)
  const e = Math.sqrt(1 - (rx * rx) / (ry * ry));
  return 2 * PI * ry * ry + ((2 * PI * rx * rx) / e) * Math.atanh(e);
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

  /** Applies a numeric field; a rejected value (empty, NaN, or non-positive when `positive`)
   *  resets the input to the last accepted one so the field never disagrees with the plot. */
  private setNumber(e: Event, key: 'h' | 'k' | 'a' | 'b' | 'p', positive = false): void {
    const input = e.target as HTMLInputElement;
    const v = parseFloat(input.value);
    if (isNaN(v) || (positive && v <= 0)) {
      input.value = String(this.params()[key]);
      return;
    }
    this.params.update((p) => ({ ...p, [key]: v }));
  }
  updateParamH(e: Event): void {
    this.setNumber(e, 'h');
  }
  updateParamK(e: Event): void {
    this.setNumber(e, 'k');
  }
  updateParamA(e: Event): void {
    this.setNumber(e, 'a', true);
  }
  updateParamB(e: Event): void {
    this.setNumber(e, 'b', true);
  }
  updateParamP(e: Event): void {
    this.setNumber(e, 'p');
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
      case 'circle': {
        const xPart = h === 0 ? 'x²' : `(x - ${h})²`;
        const yPart = k === 0 ? 'y²' : `(y - ${k})²`;
        return `${xPart} + ${yPart} = ${p.a}²`;
      }
      case 'ellipse': {
        const xPart = h === 0 ? 'x²' : `(x - ${h})²`;
        const yPart = k === 0 ? 'y²' : `(y - ${k})²`;
        return `${xPart}/${p.a}² + ${yPart}/${p.b}² = 1`;
      }
      case 'parabola':
        if (p.orientation === 'vertical') {
          const xPart = h === 0 ? 'x²' : `(x - ${h})²`;
          return `${xPart} = ${4 * p.p}(y${k !== 0 ? ' - ' + k : ''})`;
        }
        {
          const yPart = k === 0 ? 'y²' : `(y - ${k})²`;
          return `${yPart} = ${4 * p.p}(x${h !== 0 ? ' - ' + h : ''})`;
        }
      case 'hyperbola': {
        const xPart = h === 0 ? 'x²' : `(x - ${h})²`;
        const yPart = k === 0 ? 'y²' : `(y - ${k})²`;
        return `${xPart}/${p.a}² - ${yPart}/${p.b}² = 1`;
      }
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
          {
            label: 'Volume of revolution (x-axis)',
            value: `${((4 / 3) * PI * p.a * p.a * p.a).toFixed(4)}`,
          },
          { label: 'Surface of revolution (x-axis)', value: `${(4 * PI * p.a * p.a).toFixed(4)}` },
        ];
      case 'ellipse': {
        const c = Math.sqrt(Math.abs(p.a * p.a - p.b * p.b));
        const ecc = p.a > p.b ? c / p.a : c / p.b;
        const rx = p.a;
        const ry = p.b;
        const revVol = (4 / 3) * PI * rx * ry * ry;
        const revSA = ellipseRevolutionSurface(rx, ry).toFixed(4);
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Semi-axes', value: `a=${p.a}, b=${p.b}` },
          { label: 'Focal dist (c)', value: `${c.toFixed(4)}` },
          { label: 'Eccentricity', value: `${ecc.toFixed(4)}` },
          { label: 'Area', value: `${(PI * p.a * p.b).toFixed(4)}` },
          { label: 'Volume of revolution (x-axis)', value: revVol.toFixed(4) },
          { label: 'Surface of revolution (x-axis)', value: revSA },
        ];
      }
      case 'parabola':
        return [
          { label: 'Vertex', value: `(${h}, ${k})` },
          { label: 'Focal length', value: `${p.p}` },
          {
            label: 'Focus',
            value: p.orientation === 'vertical' ? `(${h}, ${k + p.p})` : `(${h + p.p}, ${k})`,
          },
          {
            label: 'Directrix',
            value: p.orientation === 'vertical' ? `y = ${k - p.p}` : `x = ${h - p.p}`,
          },
        ];
      case 'hyperbola': {
        const c = Math.sqrt(p.a * p.a + p.b * p.b);
        return [
          { label: 'Center', value: `(${h}, ${k})` },
          { label: 'Semi-axes', value: `a=${p.a}, b=${p.b}` },
          { label: 'Focal dist (c)', value: `${c.toFixed(4)}` },
          { label: 'Eccentricity', value: `${(c / p.a).toFixed(4)}` },
          {
            label: 'Asymptotes',
            value: `y = ±(${p.b}/${p.a})(x${h !== 0 ? ' - ' + h : ''})${k !== 0 ? ' + ' + k : ''}`,
          },
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
        let expr = '';
        if (A === 1) expr += 'x^2';
        else if (A === -1) expr += '-x^2';
        else expr += A + '*x^2';
        if (B === 1) expr += '+y^2';
        else if (B === -1) expr += '-y^2';
        else if (B > 0) expr += '+' + B + '*y^2';
        else expr += B + '*y^2';
        if (C !== 0) expr += (C > 0 ? '+' : '') + C + '*x';
        if (D !== 0) expr += (D > 0 ? '+' : '') + D + '*y';
        if (E !== 0) expr += (E > 0 ? '+' : '') + E;
        return expr + '=0';
      }
      case 'parabola':
        if (p.orientation === 'vertical') {
          const C = -2 * h;
          const D = -4 * p.p;
          const F = h * h + 4 * p.p * k;
          let pExpr = 'x^2';
          if (C !== 0) pExpr += (C > 0 ? '+' : '') + C + '*x';
          if (D !== 0) pExpr += (D > 0 ? '+' : '') + D + '*y';
          if (F !== 0) pExpr += (F > 0 ? '+' : '') + F;
          return pExpr + '=0';
        }
        {
          const C = -2 * k;
          const D = -4 * p.p;
          const F = k * k + 4 * p.p * h;
          let pExpr = 'y^2';
          if (C !== 0) pExpr += (C > 0 ? '+' : '') + C + '*y';
          if (D !== 0) pExpr += (D > 0 ? '+' : '') + D + '*x';
          if (F !== 0) pExpr += (F > 0 ? '+' : '') + F;
          return pExpr + '=0';
        }
      case 'hyperbola': {
        const a2 = p.a * p.a;
        const b2 = p.b * p.b;
        const A = b2;
        const B = -a2;
        const C = -2 * b2 * h;
        const D = 2 * a2 * k;
        const E = b2 * h * h - a2 * k * k - a2 * b2;
        let expr = '';
        if (A === 1) expr += 'x^2';
        else if (A === -1) expr += '-x^2';
        else expr += A + '*x^2';
        if (B === 1) expr += '+y^2';
        else if (B === -1) expr += '-y^2';
        else if (B > 0) expr += '+' + B + '*y^2';
        else expr += B + '*y^2';
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
