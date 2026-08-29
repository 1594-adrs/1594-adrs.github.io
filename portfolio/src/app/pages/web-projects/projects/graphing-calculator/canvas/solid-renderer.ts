import { Viewport } from './viewport';
import type { RotationAxis } from '../models/calculator.models';
import type { SolidRegion } from '../engine/calculus';
import { tryEval } from './utils';

function findAxisCrossings(
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  steps = 200,
): number[] {
  const h = (b - a) / steps;
  const crossings: number[] = [];
  const EPS = 1e-12;
  let prevDiff = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) {
      prevDiff = NaN;
      continue;
    }
    const diff = y - k;
    if (Math.abs(diff) < EPS) {
      crossings.push(x);
      prevDiff = diff;
      continue;
    }
    if (isFinite(prevDiff) && Math.abs(prevDiff) >= EPS && prevDiff * diff < 0) {
      const t = prevDiff / (prevDiff - diff);
      crossings.push(a + (i - 1) * h + t * h);
    }
    prevDiff = diff;
  }
  return crossings;
}

function buildCurveSegments(
  fn: (x: number) => number,
  a: number,
  b: number,
  steps: number,
): Array<Array<{ x: number; y: number }>> {
  const h = (b - a) / steps;
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) {
      if (current.length >= 2) segments.push(current);
      current = [];
    } else {
      current.push({ x, y });
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

export function drawSolidCrossSectionSingle(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis,
  width: number,
  height: number,
  color: string,
): void {
  const steps = Math.min(500, Math.max(100, Math.abs(b - a) * 20));
  const h = (b - a) / steps;
  const k = axis.value;

  if (axis.type === 'x') {
    const [, axisY] = viewport.worldToScreen(0, k, width, height);
    const axisVisible = axisY >= -10 && axisY <= height + 10;

    if (axisVisible) {
      const crossings = findAxisCrossings(fn, a, b, k);
      const boundaries = [a, ...crossings, b];
      const subRegions: Array<{ a: number; b: number; above: boolean }> = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const ra = boundaries[i];
        const rb = boundaries[i + 1];
        if (rb - ra < 1e-12) continue;
        const mid = (ra + rb) / 2;
        const yMid = tryEval(fn, mid);
        if (isNaN(yMid)) continue;
        subRegions.push({ a: ra, b: rb, above: yMid > k });
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();

      for (const region of subRegions) {
        const rSteps = Math.max(50, Math.abs(region.b - region.a) * 20);
        const ih = (region.b - region.a) / rSteps;

        ctx.beginPath();
        const [startAxisSx] = viewport.worldToScreen(region.a, k, width, height);
        ctx.moveTo(startAxisSx, axisY);

        const [endAxisSx] = viewport.worldToScreen(region.b, k, width, height);
        ctx.lineTo(endAxisSx, axisY);

        for (let i = rSteps; i >= 0; i--) {
          const x = region.a + i * ih;
          const y = tryEval(fn, x);
          if (isNaN(y)) continue;
          const [sx, sy] = viewport.worldToScreen(x, y, width, height);
          ctx.lineTo(sx, sy);
        }

        ctx.closePath();
        ctx.fillStyle = color + '18';
        ctx.fill();
      }

      ctx.restore();

      ctx.strokeStyle = '#ffaa0088';
      ctx.lineWidth = 1.5;
      const [sa] = viewport.worldToScreen(a, 0, width, height);
      const [sb] = viewport.worldToScreen(b, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(sa, axisY);
      ctx.lineTo(sb, axisY);
      ctx.stroke();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const x = a + i * h;
      const y = tryEval(fn, x);
      if (isNaN(y)) { started = false; continue; }
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    drawHorizontalBoundaryCap(ctx, viewport, fn, a, k, width, height, color);
    drawHorizontalBoundaryCap(ctx, viewport, fn, b, k, width, height, color);

    if (axisVisible) {
      drawRotationArrow(ctx, viewport, a, k, width, height, 'x', k);
    } else {
      drawEdgeIndicator(ctx, viewport, k, width, height, color, 'y');
    }
  } else {
    const [axisX] = viewport.worldToScreen(k, 0, width, height);
    const axisVisible = axisX >= -10 && axisX <= width + 10;

    const segments = buildCurveSegments(fn, a, b, steps);

    if (axisVisible) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();

      for (const seg of segments) {
        ctx.beginPath();
        const [startSx, startSy] = viewport.worldToScreen(seg[0].x, k, width, height);
        ctx.moveTo(startSx, startSy);

        const [axisEndSx, axisEndSy] = viewport.worldToScreen(seg[seg.length - 1].x, k, width, height);
        ctx.lineTo(axisEndSx, axisEndSy);

        for (let i = seg.length - 1; i >= 0; i--) {
          const [sx, sy] = viewport.worldToScreen(seg[i].x, seg[i].y, width, height);
          ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = color + '18';
        ctx.fill();
      }

      ctx.restore();

      const [, topY] = viewport.worldToScreen(0, viewport.yMax, width, height);
      const [, botY] = viewport.worldToScreen(0, viewport.yMin, width, height);
      ctx.strokeStyle = '#ffaa0088';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(axisX, topY);
      ctx.lineTo(axisX, botY);
      ctx.stroke();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const x = a + i * h;
      const y = tryEval(fn, x);
      if (isNaN(y)) { started = false; continue; }
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    drawVerticalBoundaryCap(ctx, viewport, fn, a, k, width, height, color);
    drawVerticalBoundaryCap(ctx, viewport, fn, b, k, width, height, color);

    if (axisVisible) {
      const arrowY = tryEval(fn, a);
      const safeArrowY = isNaN(arrowY) ? (viewport.yMin + viewport.yMax) / 2 : arrowY;
      drawRotationArrow(ctx, viewport, a, safeArrowY, width, height, 'y', k);
    } else {
      drawEdgeIndicator(ctx, viewport, k, width, height, color, 'x');
    }
  }
}

export function drawSolidCrossSectionMulti(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  functions: Array<(x: number) => number>,
  functionColors: string[],
  regions: SolidRegion[],
  axis: RotationAxis,
  width: number,
  height: number,
): void {
  if (regions.length === 0 || functions.length === 0) return;
  const allA = regions[0].a;
  const allB = regions[regions.length - 1].b;
  const steps = Math.min(500, Math.max(100, Math.abs(allB - allA) * 20));
  const k = axis.value;

  if (axis.type === 'x') {
    drawHorizontalMulti(ctx, viewport, functions, functionColors, regions, allA, allB, k, steps, width, height);
  } else {
    drawVerticalMulti(ctx, viewport, functions, functionColors, regions, allA, allB, k, steps, width, height);
  }
}

function drawHorizontalMulti(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  functions: Array<(x: number) => number>,
  functionColors: string[],
  regions: SolidRegion[],
  a: number,
  b: number,
  k: number,
  steps: number,
  width: number,
  height: number,
): void {
  const [, axisY] = viewport.worldToScreen(0, k, width, height);
  const axisVisible = axisY >= -10 && axisY <= height + 10;

  if (axisVisible) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (const region of regions) {
      if (region.b - region.a < 1e-12) continue;
      const topFn = functions[region.topFunctionIndex];
      const botFn = functions[region.bottomFunctionIndex];
      const color = functionColors[region.topFunctionIndex] ?? '#00ff88';
      const regionSteps = Math.max(50, Math.abs(region.b - region.a) * 20);
      const ih = (region.b - region.a) / regionSteps;

      ctx.beginPath();
      const [startSx] = viewport.worldToScreen(region.a, k, width, height);
      ctx.moveTo(startSx, axisY);

      for (let i = 0; i <= regionSteps; i++) {
        const x = region.a + i * ih;
        const y = tryEval(topFn, x);
        if (isNaN(y)) continue;
        const [sx, sy] = viewport.worldToScreen(x, y, width, height);
        ctx.lineTo(sx, sy);
      }

      for (let i = regionSteps; i >= 0; i--) {
        const x = region.a + i * ih;
        const y = tryEval(botFn, x);
        if (isNaN(y)) continue;
        const [sx, sy] = viewport.worldToScreen(x, y, width, height);
        ctx.lineTo(sx, sy);
      }

      ctx.closePath();
      ctx.fillStyle = color + '15';
      ctx.fill();
    }

    ctx.restore();

    ctx.strokeStyle = '#ffaa0066';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    const [sa] = viewport.worldToScreen(a, 0, width, height);
    const [sb] = viewport.worldToScreen(b, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(sa, axisY);
    ctx.lineTo(sb, axisY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const region of regions) {
    if (region.b - region.a < 1e-12) continue;
    const topFn = functions[region.topFunctionIndex];
    const botFn = functions[region.bottomFunctionIndex];
    const topColor = functionColors[region.topFunctionIndex] ?? '#00ff88';
    const botColor = functionColors[region.bottomFunctionIndex] ?? '#00ff88';
    const rSteps = Math.max(50, Math.abs(region.b - region.a) * 20);
    const ih = (region.b - region.a) / rSteps;

    ctx.strokeStyle = topColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= rSteps; i++) {
      const x = region.a + i * ih;
      const y = tryEval(topFn, x);
      if (isNaN(y)) { started = false; continue; }
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    if (region.bottomFunctionIndex !== region.topFunctionIndex) {
      ctx.strokeStyle = botColor + '80';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      started = false;
      for (let i = 0; i <= rSteps; i++) {
        const x = region.a + i * ih;
        const y = tryEval(botFn, x);
        if (isNaN(y)) { started = false; continue; }
        const [sx, sy] = viewport.worldToScreen(x, y, width, height);
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
  }

  drawHorizontalBoundaryCapMulti(ctx, viewport, functions, regions[0], a, k, width, height);
  drawHorizontalBoundaryCapMulti(ctx, viewport, functions, regions[regions.length - 1], b, k, width, height);

  for (let i = 1; i < regions.length; i++) {
    const ix = regions[i].a;
    const topFn = functions[regions[i].topFunctionIndex];
    const y = tryEval(topFn, ix);
    if (isNaN(y)) continue;
    const [sx, sy] = viewport.worldToScreen(ix, y, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (axisVisible) {
    drawRotationArrow(ctx, viewport, a, k, width, height, 'x', k);
  } else {
    drawEdgeIndicator(ctx, viewport, k, width, height, functionColors[0] ?? '#00ff88', 'y');
  }
}

function drawVerticalMulti(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  functions: Array<(x: number) => number>,
  functionColors: string[],
  regions: SolidRegion[],
  a: number,
  b: number,
  k: number,
  steps: number,
  width: number,
  height: number,
): void {
  const [axisX] = viewport.worldToScreen(k, 0, width, height);
  const axisVisible = axisX >= -10 && axisX <= width + 10;

  if (axisVisible) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (const region of regions) {
      if (region.b - region.a < 1e-12) continue;
      const topFn = functions[region.topFunctionIndex];
      const botFn = functions[region.bottomFunctionIndex];
      const color = functionColors[region.topFunctionIndex] ?? '#00ff88';
      const topSegs = buildCurveSegments(topFn, region.a, region.b, Math.max(50, Math.abs(region.b - region.a) * 20));
      const botSegs = buildCurveSegments(botFn, region.a, region.b, Math.max(50, Math.abs(region.b - region.a) * 20));
      const topPts = topSegs.flat();
      const botPts = botSegs.flat();
      if (topPts.length < 2 || botPts.length < 2) continue;

      ctx.beginPath();
      for (let i = 0; i < topPts.length; i++) {
        const [sx, sy] = viewport.worldToScreen(topPts[i].x, topPts[i].y, width, height);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      for (let i = botPts.length - 1; i >= 0; i--) {
        const [sx, sy] = viewport.worldToScreen(botPts[i].x, botPts[i].y, width, height);
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = color + '15';
      ctx.fill();
    }

    ctx.restore();

    const [, topY] = viewport.worldToScreen(0, viewport.yMax, width, height);
    const [, botY] = viewport.worldToScreen(0, viewport.yMin, width, height);
    ctx.strokeStyle = '#ffaa0066';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(axisX, topY);
    ctx.lineTo(axisX, botY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const region of regions) {
    if (region.b - region.a < 1e-12) continue;
    const topFn = functions[region.topFunctionIndex];
    const botFn = functions[region.bottomFunctionIndex];
    const topColor = functionColors[region.topFunctionIndex] ?? '#00ff88';
    const botColor = functionColors[region.bottomFunctionIndex] ?? '#00ff88';
    const rSteps = Math.max(50, Math.abs(region.b - region.a) * 20);
    const ih = (region.b - region.a) / rSteps;

    ctx.strokeStyle = topColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= rSteps; i++) {
      const x = region.a + i * ih;
      const y = tryEval(topFn, x);
      if (isNaN(y)) { started = false; continue; }
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    if (region.bottomFunctionIndex !== region.topFunctionIndex) {
      ctx.strokeStyle = botColor + '80';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      started = false;
      for (let i = 0; i <= rSteps; i++) {
        const x = region.a + i * ih;
        const y = tryEval(botFn, x);
        if (isNaN(y)) { started = false; continue; }
        const [sx, sy] = viewport.worldToScreen(x, y, width, height);
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
  }

  drawVerticalBoundaryCapMulti(ctx, viewport, functions, regions[0], a, k, width, height);
  drawVerticalBoundaryCapMulti(ctx, viewport, functions, regions[regions.length - 1], b, k, width, height);

  for (let i = 1; i < regions.length; i++) {
    const ix = regions[i].a;
    const topFn = functions[regions[i].topFunctionIndex];
    const y = tryEval(topFn, ix);
    if (isNaN(y)) continue;
    const [sx, sy] = viewport.worldToScreen(ix, y, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (axisVisible) {
    const arrowY = tryEval(functions[regions[0].topFunctionIndex], a);
    const safeArrowY = isNaN(arrowY) ? (viewport.yMin + viewport.yMax) / 2 : arrowY;
    drawRotationArrow(ctx, viewport, a, safeArrowY, width, height, 'y', k);
  } else {
    drawEdgeIndicator(ctx, viewport, k, width, height, functionColors[0] ?? '#00ff88', 'x');
  }
}

// ===== BOUNDARY CAPS =====

function drawHorizontalBoundaryCap(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  wx: number,
  k: number,
  width: number,
  height: number,
  color: string,
): void {
  const y = tryEval(fn, wx);
  if (isNaN(y)) return;
  const [, axisY] = viewport.worldToScreen(0, k, width, height);
  if (axisY < -10 || axisY > height + 10) return;
  const [sx, syFn] = viewport.worldToScreen(wx, y, width, height);
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx, syFn);
  ctx.lineTo(sx, axisY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVerticalBoundaryCap(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  wx: number,
  k: number,
  width: number,
  height: number,
  color: string,
): void {
  const y = tryEval(fn, wx);
  if (isNaN(y)) return;
  const [axisX] = viewport.worldToScreen(k, 0, width, height);
  if (axisX < -10 || axisX > width + 10) return;
  const [sxFn, sy] = viewport.worldToScreen(wx, y, width, height);
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sxFn, sy);
  ctx.lineTo(axisX, sy);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHorizontalBoundaryCapMulti(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  functions: Array<(x: number) => number>,
  region: SolidRegion,
  wx: number,
  k: number,
  width: number,
  height: number,
): void {
  const topY = tryEval(functions[region.topFunctionIndex], wx);
  const botY = tryEval(functions[region.bottomFunctionIndex], wx);
  if (isNaN(topY) || isNaN(botY)) return;
  const [, axisY] = viewport.worldToScreen(0, k, width, height);
  if (axisY < -10 || axisY > height + 10) return;
  const [sx, syTop] = viewport.worldToScreen(wx, topY, width, height);
  const [, syBot] = viewport.worldToScreen(wx, botY, width, height);
  ctx.strokeStyle = '#ffffff60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx, syTop);
  ctx.lineTo(sx, syBot);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVerticalBoundaryCapMulti(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  functions: Array<(x: number) => number>,
  region: SolidRegion,
  wx: number,
  k: number,
  width: number,
  height: number,
): void {
  const topY = tryEval(functions[region.topFunctionIndex], wx);
  const botY = tryEval(functions[region.bottomFunctionIndex], wx);
  if (isNaN(topY) || isNaN(botY)) return;
  const [axisX] = viewport.worldToScreen(k, 0, width, height);
  if (axisX < -10 || axisX > width + 10) return;
  const [sxTop, syTop] = viewport.worldToScreen(wx, topY, width, height);
  const [sxBot, syBot] = viewport.worldToScreen(wx, botY, width, height);
  ctx.strokeStyle = '#ffffff60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sxTop, syTop);
  ctx.lineTo(sxBot, syBot);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ===== EDGE INDICATORS =====

function drawEdgeIndicator(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  k: number,
  width: number,
  height: number,
  color: string,
  axisType: 'x' | 'y',
): void {
  if (axisType === 'y') {
    const [, axisY] = viewport.worldToScreen(0, k, width, height);
    const edgeY = Math.max(15, Math.min(height - 15, axisY));
    const above = axisY < height / 2;
    const arrowDir = above ? 1 : -1;
    ctx.fillStyle = color + '80';
    ctx.beginPath();
    ctx.moveTo(width / 2, edgeY);
    ctx.lineTo(width / 2 - 5, edgeY + arrowDir * 8);
    ctx.lineTo(width / 2 + 5, edgeY + arrowDir * 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color + 'a0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`y = ${k}`, width / 2, edgeY + arrowDir * 18);
  } else {
    const [axisX] = viewport.worldToScreen(k, 0, width, height);
    const edgeX = Math.max(15, Math.min(width - 15, axisX));
    const above = axisX < width / 2;
    const arrowDir = above ? 1 : -1;
    ctx.fillStyle = color + '80';
    ctx.beginPath();
    ctx.moveTo(edgeX, height / 2);
    ctx.lineTo(edgeX + arrowDir * 8, height / 2 - 5);
    ctx.lineTo(edgeX + arrowDir * 8, height / 2 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color + 'a0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`x = ${k}`, edgeX + arrowDir * 18, height / 2);
  }
}

// ===== ROTATION ARROW =====

function drawRotationArrow(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  wx: number,
  wy: number,
  width: number,
  height: number,
  axisType: 'x' | 'y',
  k: number,
): void {
  const arrowWx = axisType === 'x' ? wx : k;
  const arrowWy = axisType === 'x' ? k : wy;
  const [cx, cy] = viewport.worldToScreen(arrowWx, arrowWy, width, height);
  const r = 15;
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.8, Math.PI * 0.3, false);
  ctx.stroke();
  const endAngle = Math.PI * 0.3;
  const ax = cx + r * Math.cos(endAngle);
  const ay = cy + r * Math.sin(endAngle);
  const arrowLen = 7;
  const arrowAngle = 0.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(
    ax + arrowLen * Math.cos(endAngle + Math.PI - arrowAngle),
    ay + arrowLen * Math.sin(endAngle + Math.PI - arrowAngle),
  );
  ctx.moveTo(ax, ay);
  ctx.lineTo(
    ax + arrowLen * Math.cos(endAngle + Math.PI + arrowAngle),
    ay + arrowLen * Math.sin(endAngle + Math.PI + arrowAngle),
  );
  ctx.stroke();
}
