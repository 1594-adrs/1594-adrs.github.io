import { Viewport } from './viewport';
import { tryEval } from './utils';

// Canvas 2D context does not support CSS variables; colors are hardcoded intentionally.
const COLOR_LABEL_BG = '#0a0a0f';
const COLOR_LABEL_BORDER = '#333355';

export function drawFunction(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  color: string,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const pixelStep = 1;
  const maxY = viewport.yMax + (viewport.yMax - viewport.yMin) * 0.1;
  const minY = viewport.yMin - (viewport.yMax - viewport.yMin) * 0.1;

  ctx.beginPath();
  let drawing = false;

  for (let px = 0; px <= width; px += pixelStep) {
    const [wx] = viewport.screenToWorld(px, 0, width, height);
    let wy: number;
    try {
      wy = fn(wx);
    } catch {
      drawing = false;
      continue;
    }

    if (!isFinite(wy) || wy > maxY || wy < minY) {
      drawing = false;
      continue;
    }

    const [, sy] = viewport.worldToScreen(wx, wy, width, height);

    if (!drawing) {
      ctx.moveTo(px, sy);
      drawing = true;
    } else {
      ctx.lineTo(px, sy);
    }
  }
  ctx.stroke();
}

export function drawIntegralArea(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  a: number,
  b: number,
  color: string,
  width: number,
  height: number,
): void {
  const [sa] = viewport.worldToScreen(a, 0, width, height);
  const [sb] = viewport.worldToScreen(b, 0, width, height);
  const [, oy] = viewport.worldToScreen(0, 0, width, height);

  ctx.fillStyle = color + '30';
  ctx.beginPath();
  const steps = Math.max(100, Math.abs(sb - sa));
  const h = (b - a) / steps;

  ctx.moveTo(sa, oy);
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    if (isNaN(y)) continue;
    const [sx, sy] = viewport.worldToScreen(x, y, width, height);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(sb, oy);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sa, 0);
  ctx.lineTo(sa, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sb, 0);
  ctx.lineTo(sb, height);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawAreaBetween(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fUpper: (x: number) => number,
  fLower: (x: number) => number,
  a: number,
  b: number,
  color: string,
  width: number,
  height: number,
): void {
  const steps = Math.max(100, Math.abs(b - a) * 10);
  const h = (b - a) / steps;

  ctx.fillStyle = color + '25';
  ctx.beginPath();
  const [sa] = viewport.worldToScreen(a, 0, width, height);
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const yU = tryEval(fUpper, x);
    if (isNaN(yU)) { started = false; continue; }
    const [sx, sy] = viewport.worldToScreen(x, yU, width, height);
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  started = false;
  for (let i = steps; i >= 0; i--) {
    const x = a + i * h;
    const yL = tryEval(fLower, x);
    if (isNaN(yL)) { started = false; continue; }
    const [sx, sy] = viewport.worldToScreen(x, yL, width, height);
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const [sax] = viewport.worldToScreen(a, 0, width, height);
  const [sbx] = viewport.worldToScreen(b, 0, width, height);
  ctx.beginPath();
  ctx.moveTo(sax, 0);
  ctx.lineTo(sax, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sbx, 0);
  ctx.lineTo(sbx, height);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  mouseX: number,
  mouseY: number,
  fn: ((x: number) => number) | null,
  color: string,
  width: number,
  height: number,
): void {
  const [wx, wy] = viewport.screenToWorld(mouseX, mouseY, width, height);

  ctx.strokeStyle = color + '40';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(mouseX, 0);
  ctx.lineTo(mouseX, height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, mouseY);
  ctx.lineTo(width, mouseY);
  ctx.stroke();
  ctx.setLineDash([]);

  let label = `(${wx.toFixed(2)}, ${wy.toFixed(2)})`;
  if (fn) {
    try {
      const fy = fn(wx);
      if (isFinite(fy)) {
        const [, sy] = viewport.worldToScreen(wx, fy, width, height);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mouseX, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        label = `(${wx.toFixed(2)}, ${fy.toFixed(2)})`;
      }
    } catch { /* ignore */ }
  }

  ctx.fillStyle = COLOR_LABEL_BG;
  ctx.strokeStyle = COLOR_LABEL_BORDER;
  ctx.lineWidth = 1;
  ctx.font = '11px "JetBrains Mono", monospace';
  const metrics = ctx.measureText(label);
  const pad = 4;
  const lx = mouseX + 12;
  const ly = mouseY - 20;

  ctx.fillRect(lx - pad, ly - 11, metrics.width + pad * 2, 15);
  ctx.strokeRect(lx - pad, ly - 11, metrics.width + pad * 2, 15);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx, ly - 3);
}
