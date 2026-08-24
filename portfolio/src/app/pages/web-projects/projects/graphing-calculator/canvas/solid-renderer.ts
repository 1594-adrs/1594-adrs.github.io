import { Viewport } from './viewport';
import type { RotationAxis } from '../models/calculator.models';
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

function buildSubRegions(
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  crossings: number[],
): Array<{ a: number; b: number; functionAbove: boolean }> {
  const boundaries = [a, ...crossings, b];
  const regions: Array<{ a: number; b: number; functionAbove: boolean }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const ra = boundaries[i];
    const rb = boundaries[i + 1];
    if (rb - ra < 1e-12) continue;
    const mid = (ra + rb) / 2;
    const yMid = tryEval(fn, mid);
    if (isNaN(yMid)) continue;
    regions.push({ a: ra, b: rb, functionAbove: yMid > k });
  }
  return regions;
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

export function drawSolidCrossSection(
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
    drawHorizontalAxisSolid(ctx, viewport, fn, a, b, k, steps, h, width, height, color);
  } else {
    drawVerticalAxisSolid(ctx, viewport, fn, a, b, k, steps, h, width, height, color);
  }
}

// ===== HORIZONTAL AXIS (y = k) =====
// Cross-section: area between y=f(x) and y=2k-f(x) (mirror across axis)

function drawHorizontalAxisSolid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  steps: number,
  h: number,
  width: number,
  height: number,
  color: string,
): void {
  const [, axisY] = viewport.worldToScreen(0, k, width, height);
  const axisVisible = axisY >= -10 && axisY <= height + 10;

  // --- FILL: area between function and mirror across y=k ---
  if (axisVisible) {
    const crossings = findAxisCrossings(fn, a, b, k);
    const subRegions = buildSubRegions(fn, a, b, k, crossings);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (const region of subRegions) {
      const regionSteps = Math.max(50, Math.abs(region.b - region.a) * 20);
      const ih = (region.b - region.a) / regionSteps;

      ctx.beginPath();
      const [regionSa] = viewport.worldToScreen(region.a, k, width, height);
      ctx.moveTo(regionSa, axisY);

      for (let i = 0; i <= regionSteps; i++) {
        const x = region.a + i * ih;
        const y = tryEval(fn, x);
        if (isNaN(y)) continue;
        const [sx, sy] = viewport.worldToScreen(x, y, width, height);
        ctx.lineTo(sx, sy);
      }

      for (let i = regionSteps; i >= 0; i--) {
        const x = region.a + i * ih;
        const y = tryEval(fn, x);
        if (isNaN(y)) continue;
        const mirrorY = 2 * k - y;
        const [sx, sy] = viewport.worldToScreen(x, mirrorY, width, height);
        ctx.lineTo(sx, sy);
      }

      ctx.closePath();
      ctx.fillStyle = color + '15';
      ctx.fill();
    }

    ctx.restore();

    // Axis dashed line
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

  // --- OUTLINE: function curve (primary) ---
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) {
      started = false;
      continue;
    }
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // --- OUTLINE: mirror curve (secondary) ---
  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) {
      started = false;
      continue;
    }
    const mirrorY = 2 * k - y;
    const [sx, sy] = viewport.worldToScreen(x, mirrorY, width, height);
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Boundary caps: vertical lines from function to mirror at x=a and x=b
  drawHorizontalBoundaryCap(ctx, viewport, fn, a, k, width, height, color);
  drawHorizontalBoundaryCap(ctx, viewport, fn, b, k, width, height, color);

  if (axisVisible) {
    drawRotationArrow(ctx, viewport, a, k, width, height, 'x', k);
  } else {
    drawEdgeIndicator(ctx, viewport, k, width, height, color, 'y');
  }
}

// ===== VERTICAL AXIS (x = k) =====
// Cross-section: area between f(x) and its mirror f(2k-x), filling the symmetric
// polygon that represents the full profile of the solid of revolution.

function drawVerticalAxisSolid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  a: number,
  b: number,
  k: number,
  steps: number,
  h: number,
  width: number,
  height: number,
  color: string,
): void {
  const [axisX] = viewport.worldToScreen(k, 0, width, height);
  const axisVisible = axisX >= -10 && axisX <= width + 10;

  // Build curve segments (split at NaN discontinuities)
  const segments = buildCurveSegments(fn, a, b, steps);

  // --- FILL: polygon between original curve and its mirror across x=k ---
  if (axisVisible) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (const seg of segments) {
      ctx.beginPath();

      // Original curve forward
      for (let i = 0; i < seg.length; i++) {
        const [sx, sy] = viewport.worldToScreen(seg[i].x, seg[i].y, width, height);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }

      // Mirror curve backward: mirror of (x, y) across x=k is (2k-x, y)
      for (let i = seg.length - 1; i >= 0; i--) {
        const mirrorX = 2 * k - seg[i].x;
        const [sx, sy] = viewport.worldToScreen(mirrorX, seg[i].y, width, height);
        ctx.lineTo(sx, sy);
      }

      ctx.closePath();
      ctx.fillStyle = color + '15';
      ctx.fill();
    }

    ctx.restore();

    // Axis dashed line (full viewport height)
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

  // --- OUTLINE: function curve (primary) ---
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) {
      started = false;
      continue;
    }
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // --- OUTLINE: mirror curve (secondary) ---
  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) {
      started = false;
      continue;
    }
    const mirrorX = 2 * k - x;
    const [sx, sy] = viewport.worldToScreen(mirrorX, y, width, height);
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // --- Boundary caps: horizontal lines from function to mirror at x=a and x=b ---
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
  const [, syMirror] = viewport.worldToScreen(wx, 2 * k - y, width, height);
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx, syFn);
  ctx.lineTo(sx, syMirror);
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
  const [sxMirror] = viewport.worldToScreen(2 * k - wx, y, width, height);
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sxFn, sy);
  ctx.lineTo(sxMirror, sy);
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
