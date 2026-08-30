import { Viewport } from './viewport';
import { tryEval } from './utils';
import type { Asymptote } from '../engine/asymptote-detector';

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

  const steps = Math.max(100, Math.abs(sb - sa));
  const h = (b - a) / steps;

  ctx.fillStyle = color + '30';
  let drawing = false;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const y = tryEval(fn, x);
    const [sx, sy] = viewport.worldToScreen(x, isNaN(y) ? 0 : y, width, height);

    if (isNaN(y)) {
      if (drawing) {
        ctx.lineTo(sx, oy);
        ctx.closePath();
        ctx.fill();
        drawing = false;
      }
      continue;
    }

    if (!drawing) {
      ctx.beginPath();
      ctx.moveTo(sx, oy);
      ctx.lineTo(sx, sy);
      drawing = true;
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  if (drawing) {
    ctx.lineTo(sb, oy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

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

  ctx.restore();
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
  const steps = Math.max(200, Math.abs(b - a) * 20);
  const h = (b - a) / steps;

  const subIntervals: Array<{ start: number; end: number; topIsUpper: boolean }> = [];
  const crossPoints: number[] = [];
  const EPS = 1e-12;
  let prevDiff = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * h;
    const yU = tryEval(fUpper, x);
    const yL = tryEval(fLower, x);
    if (isNaN(yU) || isNaN(yL)) {
      prevDiff = NaN;
      continue;
    }
    const diff = yU - yL;
    if (Math.abs(diff) < EPS) {
      crossPoints.push(x);
      prevDiff = diff;
      continue;
    }
    if (isFinite(prevDiff) && Math.abs(prevDiff) >= EPS && prevDiff * diff < 0) {
      const t = prevDiff / (prevDiff - diff);
      crossPoints.push(a + (i - 1) * h + t * h);
    }
    prevDiff = diff;
  }

  const boundaries = [a, ...crossPoints, b];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const ia = boundaries[i];
    const ib = boundaries[i + 1];
    const mid = (ia + ib) / 2;
    const yU = tryEval(fUpper, mid);
    const yL = tryEval(fLower, mid);
    if (isNaN(yU) || isNaN(yL)) continue;
    subIntervals.push({ start: ia, end: ib, topIsUpper: yU >= yL });
  }

  ctx.fillStyle = color + '25';

  for (const interval of subIntervals) {
    const { start, end, topIsUpper } = interval;
    const intervalSteps = Math.max(50, Math.abs(end - start) * 20);
    const ih = (end - start) / intervalSteps;

    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= intervalSteps; i++) {
      const x = start + i * ih;
      const y = topIsUpper ? tryEval(fUpper, x) : tryEval(fLower, x);
      if (isNaN(y)) {
        if (drawing) {
          const prevX = start + (i - 1) * ih;
          const prevY = topIsUpper ? tryEval(fUpper, prevX) : tryEval(fLower, prevX);
          if (!isNaN(prevY)) {
            const [sx, sy] = viewport.worldToScreen(prevX, prevY, width, height);
            ctx.lineTo(sx, sy);
          }
          drawing = false;
        }
        continue;
      }
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!drawing) {
        ctx.moveTo(sx, sy);
        drawing = true;
      } else ctx.lineTo(sx, sy);
    }
    for (let i = intervalSteps; i >= 0; i--) {
      const x = start + i * ih;
      const y = topIsUpper ? tryEval(fLower, x) : tryEval(fUpper, x);
      if (isNaN(y)) continue;
      const [sx, sy] = viewport.worldToScreen(x, y, width, height);
      if (!drawing) {
        ctx.moveTo(sx, sy);
        drawing = true;
      } else ctx.lineTo(sx, sy);
    }
    if (drawing) {
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

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

  for (const cp of crossPoints) {
    const [cpx] = viewport.worldToScreen(cp, 0, width, height);
    ctx.strokeStyle = color + '40';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cpx, 0);
    ctx.lineTo(cpx, height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.beginPath();
    const [, cpy] = viewport.worldToScreen(cp, tryEval(fUpper, cp), width, height);
    ctx.arc(cpx, cpy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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
    } catch {
      /* ignore */
    }
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

export function drawParametric(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fnX: (t: number) => number,
  fnY: (t: number) => number,
  tMin: number,
  tMax: number,
  color: string,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const steps = Math.min(10000, Math.max(500, Math.abs(tMax - tMin) * 50));
  const dt = (tMax - tMin) / steps;

  const maxY = viewport.yMax + (viewport.yMax - viewport.yMin) * 0.1;
  const minY = viewport.yMin - (viewport.yMax - viewport.yMin) * 0.1;

  ctx.beginPath();
  let drawing = false;

  for (let i = 0; i <= steps; i++) {
    const t = tMin + i * dt;
    const wx = tryEval(fnX, t);
    const wy = tryEval(fnY, t);
    if (isNaN(wx) || isNaN(wy) || !isFinite(wx) || !isFinite(wy) || wy > maxY || wy < minY) {
      drawing = false;
      continue;
    }
    const [sx, sy] = viewport.worldToScreen(wx, wy, width, height);
    if (!drawing) {
      ctx.moveTo(sx, sy);
      drawing = true;
    } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

export function drawPolar(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (theta: number) => number,
  thetaMin: number,
  thetaMax: number,
  color: string,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const steps = Math.min(10000, Math.max(500, Math.abs(thetaMax - thetaMin) * 50));
  const dtheta = (thetaMax - thetaMin) / steps;

  const maxY = viewport.yMax + (viewport.yMax - viewport.yMin) * 0.1;
  const minY = viewport.yMin - (viewport.yMax - viewport.yMin) * 0.1;
  const maxX = viewport.xMax + (viewport.xMax - viewport.xMin) * 0.1;
  const minX = viewport.xMin - (viewport.xMax - viewport.xMin) * 0.1;

  ctx.beginPath();
  let drawing = false;

  for (let i = 0; i <= steps; i++) {
    const theta = thetaMin + i * dtheta;
    const r = tryEval(fn, theta);
    if (isNaN(r) || !isFinite(r)) {
      drawing = false;
      continue;
    }
    const wx = r * Math.cos(theta);
    const wy = r * Math.sin(theta);
    if (wx < minX || wx > maxX || wy < minY || wy > maxY) {
      drawing = false;
      continue;
    }
    const [sx, sy] = viewport.worldToScreen(wx, wy, width, height);
    if (!drawing) {
      ctx.moveTo(sx, sy);
      drawing = true;
    } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

export function drawInequality(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number) => number,
  comparison: '>' | '<' | '>=' | '<=',
  color: string,
  width: number,
  height: number,
): void {
  drawFunction(ctx, viewport, fn, color, width, height);

  const maxY = viewport.yMax + (viewport.yMax - viewport.yMin) * 0.1;
  const minY = viewport.yMin - (viewport.yMax - viewport.yMin) * 0.1;

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = color;

  const check = (yMouse: number, yFn: number): boolean => {
    switch (comparison) {
      case '>':
        return yMouse > yFn;
      case '<':
        return yMouse < yFn;
      case '>=':
        return yMouse >= yFn;
      case '<=':
        return yMouse <= yFn;
    }
  };

  for (let px = 0; px <= width; px += 2) {
    const [wx] = viewport.screenToWorld(px, 0, width, height);
    const wyFn = tryEval(fn, wx);
    if (isNaN(wyFn) || !isFinite(wyFn)) continue;

    const [, syFn] = viewport.worldToScreen(wx, wyFn, width, height);
    const [, syTop] = viewport.worldToScreen(wx, maxY, width, height);
    const [, syBot] = viewport.worldToScreen(wx, minY, width, height);

    const top = Math.max(syTop, 0);
    const bot = Math.min(syBot, height);

    if (check(top, syFn)) {
      ctx.fillRect(px, top, 2, Math.max(0, syFn - top));
    }
    if (check(bot, syFn)) {
      ctx.fillRect(px, syFn, 2, Math.max(0, bot - syFn));
    }
  }

  ctx.restore();
}

export function drawImplicitInequality(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number, y: number) => number,
  comparison: '>' | '<' | '>=' | '<=',
  color: string,
  width: number,
  height: number,
): void {
  const step = 2;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = color;

  const check = (val: number): boolean => {
    switch (comparison) {
      case '>':
        return val > 0;
      case '<':
        return val < 0;
      case '>=':
        return val >= 0;
      case '<=':
        return val <= 0;
    }
  };

  for (let px = 0; px <= width; px += step) {
    for (let py = 0; py <= height; py += step) {
      const [wx, wy] = viewport.screenToWorld(px, py, width, height);
      try {
        const val = fn(wx, wy);
        if (check(val)) {
          ctx.fillRect(px, py, step, step);
        }
      } catch {
        /* skip */
      }
    }
  }

  ctx.restore();
}

export function drawAsymptote(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  asymptote: Asymptote,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = '#666680';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  if (asymptote.type === 'vertical') {
    const [sx] = viewport.worldToScreen(asymptote.value, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    ctx.fillStyle = '#666680';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(asymptote.equation, sx + 4, 14);
  } else if (asymptote.type === 'horizontal') {
    const [, sy] = viewport.worldToScreen(0, asymptote.value, width, height);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    ctx.fillStyle = '#666680';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(asymptote.equation, 4, sy - 4);
  } else if (asymptote.type === 'oblique') {
    const y1 = asymptote.value * viewport.xMin + (asymptote.intercept ?? 0);
    const y2 = asymptote.value * viewport.xMax + (asymptote.intercept ?? 0);
    const [sx1, sy1] = viewport.worldToScreen(viewport.xMin, y1, width, height);
    const [sx2, sy2] = viewport.worldToScreen(viewport.xMax, y2, width, height);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }

  ctx.restore();
}
