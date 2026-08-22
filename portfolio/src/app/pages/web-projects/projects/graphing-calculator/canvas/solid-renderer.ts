import { Viewport } from './viewport';
import type { RotationAxis } from '../models/calculator.models';
import { tryEval, safeY } from './utils';

export function drawSolidCrossSection(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  a: number,
  b: number,
  axis: RotationAxis,
  width: number,
  height: number,
): void {
  const steps = Math.max(100, Math.abs(b - a) * 20);
  const h = (b - a) / steps;
  const k = axis.value;

  if (axis.type === 'x') {
    drawHorizontalAxisSolid(ctx, viewport, fn, a, b, k, steps, h, width, height);
  } else {
    drawVerticalAxisSolid(ctx, viewport, fn, a, b, k, steps, h, width, height);
  }
}

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
): void {
  const [, axisY] = viewport.worldToScreen(0, k, width, height);
  const [sa] = viewport.worldToScreen(a, 0, width, height);
  const [sb] = viewport.worldToScreen(b, 0, width, height);

  ctx.strokeStyle = '#ffaa0066';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(sa - 20, axisY);
  ctx.lineTo(sb + 20, axisY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
  ctx.beginPath();
  ctx.moveTo(sa, axisY);
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) continue;
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(sb, axisY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 204, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(sa, axisY);
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) continue;
    const mirrorY = 2 * k - y;
    const [sx, sy] = viewport.worldToScreen(x, mirrorY, width, height);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(sb, axisY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) { started = false; continue; }
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 204, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) { started = false; continue; }
    const mirrorY = 2 * k - y;
    const [sx, sy] = viewport.worldToScreen(x, mirrorY, width, height);
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  drawRotationArrow(ctx, viewport, (a + b) / 2, k, width, height);
}

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
): void {
  const [axisX] = viewport.worldToScreen(k, 0, width, height);
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

  ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
  ctx.beginPath();
  const [sa] = viewport.worldToScreen(a, 0, width, height);
  const [sb] = viewport.worldToScreen(b, 0, width, height);
  ctx.moveTo(sa, botY);
  ctx.lineTo(sa, topY);
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) continue;
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(sb, botY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) { started = false; continue; }
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 204, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  for (let i = 0; i <= steps; i += Math.max(1, Math.floor(steps / 10))) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) continue;
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(axisX, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const midX = (a + b) / 2;
  const midY = tryEval(fn, midX);
  const safeMidY = isNaN(midY) ? (viewport.yMin + viewport.yMax) / 2 : midY;
  drawRotationArrow(ctx, viewport, midX, safeMidY, width, height);
}

function drawRotationArrow(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  wx: number,
  wy: number,
  width: number,
  height: number,
): void {
  const [cx, cy] = viewport.worldToScreen(wx, wy, width, height);
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx - 7, cy - 5);
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx - 7, cy + 5);
  ctx.stroke();
}
