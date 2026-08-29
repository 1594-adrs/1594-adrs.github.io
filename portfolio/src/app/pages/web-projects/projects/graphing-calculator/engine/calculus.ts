import { integrate } from './integrator';
import type { RotationAxis } from '../models/calculator.models';

const RESULT_LIMIT = 1e15;

function clampResult(v: number): number {
  if (!isFinite(v)) return v;
  if (v > RESULT_LIMIT) return Number.POSITIVE_INFINITY;
  if (v < -RESULT_LIMIT) return Number.NEGATIVE_INFINITY;
  return v;
}

export function derivative(f: (x: number) => number, x: number, h = 0.0001): number {
  const fc = f(x);
  if (!isFinite(fc)) return 0;
  const fph = f(x + h);
  const fmh = f(x - h);
  if (!isFinite(fph) || !isFinite(fmh)) return 0;
  const d = (fph - fmh) / (2 * h);
  if (!isFinite(d)) return 0;
  return d;
}

export interface SolidRegion {
  a: number;
  b: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
}

export function solidVolumeSingle(
  f: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis,
): number {
  const k = axis.value;
  if (axis.type === 'x') {
    return clampResult(Math.PI * integrate((x) => Math.pow(f(x) - k, 2), a, b));
  }
  return clampResult(2 * Math.PI * integrate((x) => Math.abs(x - k) * f(x), a, b));
}

export function solidSurfaceAreaSingle(
  f: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis,
): number {
  const k = axis.value;
  if (axis.type === 'x') {
    return clampResult(
      2 * Math.PI * integrate(
        (x) => Math.abs(f(x) - k) * Math.sqrt(1 + Math.pow(derivative(f, x), 2)),
        a, b,
      ),
    );
  }
  return clampResult(
    2 * Math.PI * integrate(
      (x) => Math.abs(x - k) * Math.sqrt(1 + Math.pow(derivative(f, x), 2)),
      a, b,
    ),
  );
}

export function areaSingle(
  f: (x: number) => number,
  a: number,
  b: number,
): number {
  return clampResult(integrate((x) => Math.abs(f(x)), a, b));
}

function outerInnerR(topY: number, botY: number, k: number): { outerR: number; innerR: number } {
  const dTop = Math.abs(topY - k);
  const dBot = Math.abs(botY - k);
  return dTop >= dBot ? { outerR: dTop, innerR: dBot } : { outerR: dBot, innerR: dTop };
}

function makeIntegrandVolumeH(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  k: number,
): (x: number) => number {
  return (x: number) => {
    const topVal = functions[topIdx](x);
    const botVal = functions[bottomIdx](x);
    if (!isFinite(topVal) || !isFinite(botVal)) return 0;
    const { outerR, innerR } = outerInnerR(topVal, botVal, k);
    return outerR * outerR - innerR * innerR;
  };
}

function makeIntegrandVolumeV(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  k: number,
): (x: number) => number {
  return (x: number) => {
    const topVal = functions[topIdx](x);
    const botVal = functions[bottomIdx](x);
    if (!isFinite(topVal) || !isFinite(botVal)) return 0;
    return Math.abs(x - k) * Math.abs(topVal - botVal);
  };
}

function makeIntegrandSurfaceOuterH(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  k: number,
): (x: number) => number {
  return (x: number) => {
    const topVal = functions[topIdx](x);
    const botVal = functions[bottomIdx](x);
    if (!isFinite(topVal) || !isFinite(botVal)) return 0;
    const { outerR } = outerInnerR(topVal, botVal, k);
    const isTopOuter = Math.abs(topVal - k) >= Math.abs(botVal - k);
    const fn = isTopOuter ? functions[topIdx] : functions[bottomIdx];
    return outerR * Math.sqrt(1 + Math.pow(derivative(fn, x), 2));
  };
}

function makeIntegrandSurfaceInnerH(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  k: number,
): (x: number) => number {
  return (x: number) => {
    const topVal = functions[topIdx](x);
    const botVal = functions[bottomIdx](x);
    if (!isFinite(topVal) || !isFinite(botVal)) return 0;
    const { innerR } = outerInnerR(topVal, botVal, k);
    const isTopInner = Math.abs(topVal - k) < Math.abs(botVal - k);
    const fn = isTopInner ? functions[topIdx] : functions[bottomIdx];
    return innerR * Math.sqrt(1 + Math.pow(derivative(fn, x), 2));
  };
}

function makeIntegrandSurfaceOuterV(
  functions: Array<(x: number) => number>,
  topIdx: number,
  _bottomIdx: number,
  _k: number,
): (x: number) => number {
  return (x: number) => {
    const topVal = functions[topIdx](x);
    if (!isFinite(topVal)) return 0;
    return Math.abs(x - _k) * Math.sqrt(1 + Math.pow(derivative(functions[topIdx], x), 2));
  };
}

function makeIntegrandSurfaceInnerV(
  functions: Array<(x: number) => number>,
  _topIdx: number,
  bottomIdx: number,
  k: number,
): (x: number) => number {
  return (x: number) => {
    const botVal = functions[bottomIdx](x);
    if (!isFinite(botVal)) return 0;
    return Math.abs(x - k) * Math.sqrt(1 + Math.pow(derivative(functions[bottomIdx], x), 2));
  };
}

function computeCapAreaH(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  k: number,
  wx: number,
): number {
  const topY = functions[topIdx](wx);
  const botY = functions[bottomIdx](wx);
  if (!isFinite(topY) || !isFinite(botY)) return 0;
  const { outerR, innerR } = outerInnerR(topY, botY, k);
  return Math.PI * (outerR * outerR - innerR * innerR);
}

function computeCapAreaV(
  functions: Array<(x: number) => number>,
  topIdx: number,
  bottomIdx: number,
  k: number,
  wx: number,
): number {
  const topY = functions[topIdx](wx);
  const botY = functions[bottomIdx](wx);
  if (!isFinite(topY) || !isFinite(botY)) return 0;
  return 2 * Math.PI * Math.abs(wx - k) * Math.abs(topY - botY);
}

export function solidVolumeMulti(
  functions: Array<(x: number) => number>,
  regions: SolidRegion[],
  axis: RotationAxis,
): number {
  if (regions.length === 0) return 0;
  const k = axis.value;
  let total = 0;

  for (const region of regions) {
    if (region.b - region.a < 1e-12) continue;
    const factor = axis.type === 'x' ? Math.PI : 2 * Math.PI;
    const integrand =
      axis.type === 'x'
        ? makeIntegrandVolumeH(functions, region.topFunctionIndex, region.bottomFunctionIndex, k)
        : makeIntegrandVolumeV(functions, region.topFunctionIndex, region.bottomFunctionIndex, k);
    total += factor * integrate(integrand, region.a, region.b);
  }

  return clampResult(total);
}

export function solidSurfaceAreaMulti(
  functions: Array<(x: number) => number>,
  regions: SolidRegion[],
  axis: RotationAxis,
): number {
  if (regions.length === 0) return 0;
  const k = axis.value;
  let total = 0;

  for (const region of regions) {
    if (region.b - region.a < 1e-12) continue;

    const outerIntegrand =
      axis.type === 'x'
        ? makeIntegrandSurfaceOuterH(functions, region.topFunctionIndex, region.bottomFunctionIndex, k)
        : makeIntegrandSurfaceOuterV(functions, region.topFunctionIndex, region.bottomFunctionIndex, k);
    total += 2 * Math.PI * integrate(outerIntegrand, region.a, region.b);

    const innerIntegrand =
      axis.type === 'x'
        ? makeIntegrandSurfaceInnerH(functions, region.topFunctionIndex, region.bottomFunctionIndex, k)
        : makeIntegrandSurfaceInnerV(functions, region.topFunctionIndex, region.bottomFunctionIndex, k);
    total += 2 * Math.PI * integrate(innerIntegrand, region.a, region.b);
  }

  if (regions.length > 0) {
    const first = regions[0];
    const last = regions[regions.length - 1];
    const capFn =
      axis.type === 'x'
        ? computeCapAreaH.bind(null, functions, first.topFunctionIndex, first.bottomFunctionIndex, k)
        : computeCapAreaV.bind(null, functions, first.topFunctionIndex, first.bottomFunctionIndex, k);
    total += capFn(first.a) + capFn(last.b);
  }

  return clampResult(total);
}

export interface AreaRegion {
  a: number;
  b: number;
  area: number;
  topFunctionIndex: number;
  bottomFunctionIndex: number;
}

export function areaParametric(
  fnX: (t: number) => number,
  fnY: (t: number) => number,
  tA: number,
  tB: number,
): number {
  const h = 0.0001;
  const f = (t: number) => {
    const y = fnY(t);
    const dxdt = (fnX(t + h) - fnX(t - h)) / (2 * h);
    return isFinite(y) && isFinite(dxdt) ? y * dxdt : 0;
  };
  return clampResult(integrate(f, tA, tB));
}

export function areaPolar(
  fn: (theta: number) => number,
  thetaA: number,
  thetaB: number,
): number {
  const f = (theta: number) => {
    const r = fn(theta);
    return isFinite(r) ? r * r : 0;
  };
  return clampResult(0.5 * integrate(f, thetaA, thetaB));
}

export function solidVolumeParametric(
  fnX: (t: number) => number,
  fnY: (t: number) => number,
  tA: number,
  tB: number,
  axis: { type: 'x' | 'y'; k: number },
): number {
  const h = 0.0001;
  const f = (t: number) => {
    const x = fnX(t);
    const y = fnY(t);
    const dxdt = (fnX(t + h) - fnX(t - h)) / (2 * h);
    const dydt = (fnY(t + h) - fnY(t - h)) / (2 * h);
    const ds = Math.sqrt(dxdt * dxdt + dydt * dydt);
    if (!isFinite(ds)) return 0;

    if (axis.type === 'x') {
      const radius = Math.abs(y - axis.k);
      return 2 * Math.PI * radius * Math.abs(dxdt);
    }
    const radius = Math.abs(x - axis.k);
    return 2 * Math.PI * radius * Math.abs(dydt);
  };
  return clampResult(integrate(f, tA, tB));
}

export function solidVolumePolar(
  fn: (theta: number) => number,
  thetaA: number,
  thetaB: number,
  axis: { type: 'x' | 'y'; k: number },
): number {
  const f = (theta: number) => {
    const r = fn(theta);
    if (!isFinite(r)) return 0;

    if (axis.type === 'x') {
      return Math.PI * r * r * Math.sin(theta) * Math.sin(theta);
    }
    return Math.PI * r * r * Math.cos(theta) * Math.cos(theta);
  };
  return clampResult(integrate(f, thetaA, thetaB));
}

export function derivativeParametric(
  fnX: (t: number) => number,
  fnY: (t: number) => number,
  t: number,
  h = 0.0001,
): number {
  const dxdt = (fnX(t + h) - fnX(t - h)) / (2 * h);
  const dydt = (fnY(t + h) - fnY(t - h)) / (2 * h);
  if (Math.abs(dxdt) < 1e-15) return Infinity;
  const d = dydt / dxdt;
  return isFinite(d) ? d : 0;
}

export function derivativePolar(
  fn: (theta: number) => number,
  theta: number,
  h = 0.0001,
): number {
  const r = fn(theta);
  const drdt = (fn(theta + h) - fn(theta - h)) / (2 * h);
  if (!isFinite(r) || !isFinite(drdt)) return 0;
  const num = drdt * Math.sin(theta) + r * Math.cos(theta);
  const den = drdt * Math.cos(theta) - r * Math.sin(theta);
  if (Math.abs(den) < 1e-15) return Infinity;
  const d = num / den;
  return isFinite(d) ? d : 0;
}

export function derivativeImplicit(
  fn: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 0.0001,
): number {
  const fx = (fn(x + h, y) - fn(x - h, y)) / (2 * h);
  const fy = (fn(x, y + h) - fn(x, y - h)) / (2 * h);
  if (Math.abs(fy) < 1e-15) return Infinity;
  const d = -fx / fy;
  return isFinite(d) ? d : 0;
}
