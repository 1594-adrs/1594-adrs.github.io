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


