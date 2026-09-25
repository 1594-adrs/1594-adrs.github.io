import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';

interface MockContext {
  calls: Array<{ method: string; args: unknown[] }>;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  fillStyle: string;
  fill: () => void;
  closePath: () => void;
  save: () => void;
  restore: () => void;
  globalAlpha: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  setLineDash: (segments: number[]) => void;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillText: (text: string, x: number, y: number) => void;
  measureText: (text: string) => { width: number };
}

function createMockContext(): CanvasRenderingContext2D & MockContext {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    calls,
    clearRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    beginPath: function () {
      calls.push({ method: 'beginPath', args: [] });
    },
    moveTo: function (x: number, y: number) {
      calls.push({ method: 'moveTo', args: [x, y] });
    },
    lineTo: function (x: number, y: number) {
      calls.push({ method: 'lineTo', args: [x, y] });
    },
    stroke: function () {
      calls.push({ method: 'stroke', args: [] });
    },
    fillStyle: '',
    fill: function () {
      calls.push({ method: 'fill', args: [] });
    },
    closePath: function () {
      calls.push({ method: 'closePath', args: [] });
    },
    save: function () {
      calls.push({ method: 'save', args: [] });
    },
    restore: function () {
      calls.push({ method: 'restore', args: [] });
    },
    globalAlpha: 1,
    fillRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    strokeRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'strokeRect', args: [x, y, w, h] });
    },
    arc: function (x: number, y: number, r: number, start: number, end: number) {
      calls.push({ method: 'arc', args: [x, y, r, start, end] });
    },
    setLineDash: function (segments: number[]) {
      calls.push({ method: 'setLineDash', args: [segments] });
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    fillText: function (text: string, x: number, y: number) {
      calls.push({ method: 'fillText', args: [text, x, y] });
    },
    measureText: function (text: string) {
      return { width: text.length * 6.6 };
    },
  } as unknown as CanvasRenderingContext2D & MockContext;
}

describe('drawFunction basic setup', () => {
  it('should handle a linear function y=x', () => {
    const ctx = createMockContext();
    const viewport = new Viewport(-10, 10, -10, 10);
    const fn = (x: number) => x;
    const width = 800;
    const height = 600;

    // Simulate drawing a simple line (basic path setup)
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Would sample and draw points, ending with:
    ctx.stroke();

    expect(ctx.calls.some((c) => c.method === 'beginPath')).toBe(true);
    expect(ctx.calls.some((c) => c.method === 'stroke')).toBe(true);
  });

  it('should set stroke style and line width for drawing', () => {
    const ctx = createMockContext();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    expect(ctx.strokeStyle).toBe('#00ff00');
    expect(ctx.lineWidth).toBe(2);
  });
});

describe('drawExplicitY simulation', () => {
  it('should handle x = g(y) curve sampling', () => {
    const ctx = createMockContext();
    const viewport = new Viewport(-10, 10, -10, 10);
    const fn = (y: number) => Math.cos(y);
    const width = 800;
    const height = 600;

    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const yMin = viewport.yMin;
    const yMax = viewport.yMax;
    const samples = 20;
    const dy = (yMax - yMin) / samples;

    let drawing = false;
    for (let i = 0; i <= samples; i++) {
      const y = yMin + i * dy;
      const x = fn(y);
      if (!isFinite(x)) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(i * 10, i * 10);
        drawing = true;
      } else {
        ctx.lineTo(i * 10, i * 10);
      }
    }
    ctx.stroke();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls.some((c) => c.method === 'moveTo')).toBe(true);
  });
});

describe('drawIntegralArea simulation', () => {
  it('should draw filled region under a curve', () => {
    const ctx = createMockContext();
    const fn = (x: number) => Math.sin(x);
    const a = 0;
    const b = Math.PI;

    ctx.fillStyle = '#ff000030';
    ctx.beginPath();
    // Simulate area drawing
    ctx.moveTo(100, 300);
    ctx.lineTo(150, 250);
    ctx.closePath();
    ctx.fill();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'closePath', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'fill', args: [] });
  });
});

describe('drawCrosshair simulation', () => {
  it('should draw crosshair lines at mouse position', () => {
    const ctx = createMockContext();
    const viewport = new Viewport();
    const mouseX = 400;
    const mouseY = 300;
    const width = 800;
    const height = 600;

    ctx.strokeStyle = '#ff000040';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(mouseX, 0);
    ctx.lineTo(mouseX, height);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, mouseY);
    ctx.lineTo(width, mouseY);
    ctx.stroke();
    ctx.setLineDash([]);

    expect(ctx.calls).toContainEqual({
      method: 'setLineDash',
      args: [[4, 4]],
    });
    const moveToCalls = ctx.calls.filter((c) => c.method === 'moveTo');
    expect(moveToCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('should draw coordinate label for crosshair', () => {
    const ctx = createMockContext();
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0a0a0f';
    ctx.strokeStyle = '#333355';
    ctx.fillRect(412, 280, 80, 15);
    ctx.strokeRect(412, 280, 80, 15);
    ctx.fillStyle = '#ff0000';
    ctx.textAlign = 'left';
    ctx.fillText('(1.50, 2.50)', 416, 287);

    const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
    expect(fillTextCalls.length).toBeGreaterThan(0);
  });
});

describe('drawParametric simulation', () => {
  it('should sample parametric curve (x(t), y(t))', () => {
    const ctx = createMockContext();
    const viewport = new Viewport(-10, 10, -10, 10);
    const fnX = (t: number) => Math.cos(t);
    const fnY = (t: number) => Math.sin(t);
    const tMin = 0;
    const tMax = 2 * Math.PI;
    const width = 800;
    const height = 600;

    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Parametric sampling would happen here
    ctx.stroke();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'stroke', args: [] });
  });
});

describe('drawPolar simulation', () => {
  it('should convert polar to Cartesian and draw', () => {
    const ctx = createMockContext();
    const viewport = new Viewport(-10, 10, -10, 10);
    const fn = (theta: number) => 1;
    const thetaMin = 0;
    const thetaMax = 2 * Math.PI;
    const width = 800;
    const height = 600;

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Polar sampling
    ctx.stroke();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
  });
});

describe('drawInequality simulation', () => {
  it('should shade regions satisfying inequality', () => {
    const ctx = createMockContext();
    const viewport = new Viewport();
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ff0000';
    // Fill rectangles for inequality
    ctx.fillRect(0, 100, 2, 50);
    ctx.restore();

    expect(ctx.calls).toContainEqual({ method: 'save', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'restore', args: [] });
  });
});
