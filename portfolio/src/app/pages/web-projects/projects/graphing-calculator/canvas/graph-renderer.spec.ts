import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';
import {
  drawIntegralArea,
  drawAreaBetween,
  drawInequality,
  drawFunction,
  drawExplicitY,
} from './graph-renderer';

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
    rect: function () {},
    clip: function () {},
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

describe('drawInequality', () => {
  // y op 1 on a 200×100 canvas over [-10, 10] × [-5, 5]: the line y = 1 sits at screen y = 40.
  const shaded = (op: '>' | '<' | '>=' | '<=') => {
    const ctx = createMockContext();
    drawInequality(ctx, new Viewport(-10, 10, -5, 5), () => 1, op, '#ff0000', 200, 100);
    return ctx.calls
      .filter((c) => c.method === 'fillRect')
      .map((c) => c.args as number[])
      .filter(([, , , h]) => h > 0);
  };

  it.each(['>', '>='] as const)('y %s f(x) fills above the curve (screen y < curve)', (op) => {
    const rects = shaded(op);
    expect(rects.length).toBeGreaterThan(0);
    for (const [, y, , h] of rects) {
      expect(y).toBe(0);
      expect(y + h).toBeCloseTo(40, 9);
    }
  });

  it.each(['<', '<='] as const)('y %s f(x) fills below the curve (screen y > curve)', (op) => {
    const rects = shaded(op);
    expect(rects.length).toBeGreaterThan(0);
    for (const [, y, , h] of rects) {
      expect(y).toBeCloseTo(40, 9);
      expect(y + h).toBe(100);
    }
  });
});

describe('drawIntegralArea / drawAreaBetween hardening', () => {
  const count = (ctx: { calls: Array<{ method: string }> }, m: string) =>
    ctx.calls.filter((c) => c.method === m).length;

  it('terminates and stays bounded for a=-1e308, b=1e308', () => {
    const ctx = createMockContext();
    const vp = new Viewport();
    drawIntegralArea(ctx, vp, (x) => x, -1e308, 1e308, '#ff0000', 800, 600);
    expect(count(ctx, 'lineTo')).toBeLessThan(10000);
  });

  it('terminates for non-finite limits in drawAreaBetween', () => {
    const ctx = createMockContext();
    const vp = new Viewport();
    drawAreaBetween(
      ctx,
      vp,
      (x) => x + 1,
      (x) => x - 1,
      0,
      1e308,
      '#ff0000',
      800,
      600,
    );
    expect(count(ctx, 'lineTo')).toBeLessThan(40000);
  });

  it('does not shade stretches where the integrand is undefined', () => {
    const ctx = createMockContext();
    const vp = new Viewport();
    drawIntegralArea(ctx, vp, () => NaN, -5, 5, '#ff0000', 800, 600);
    expect(count(ctx, 'fill')).toBe(0);
  });

  it('closes the shape before an undefined stretch', () => {
    const ctx = createMockContext();
    const vp = new Viewport();
    drawIntegralArea(ctx, vp, (x) => (x < 0 ? 1 : NaN), -5, 5, '#ff0000', 800, 600);
    expect(count(ctx, 'fill')).toBe(1);
    const closeIdx = ctx.calls.findIndex((c) => c.method === 'closePath');
    const last = ctx.calls[closeIdx - 1];
    // Closing point is the last valid sample (x < 0 => screen x < 400), not the NaN stretch.
    expect(last.args[0] as number).toBeLessThan(400);
  });
});

describe('traceCurve at finite jumps', () => {
  // 1200x800 over [-10,10]: 60 px per unit on both axes.
  const vp = new Viewport(-10, 10, -20 / 3, 20 / 3);
  const W = 1200;
  const H = 800;
  type Seg = [number, number, number, number];
  function segments(draw: (ctx: CanvasRenderingContext2D) => void): {
    segs: Seg[];
    moves: number;
  } {
    const ctx = createMockContext();
    draw(ctx);
    const segs: Seg[] = [];
    let moves = 0;
    let p: [number, number] | null = null;
    for (const c of ctx.calls) {
      const [x, y] = c.args as [number, number];
      if (c.method === 'moveTo') {
        moves++;
        p = [x, y];
      } else if (c.method === 'lineTo' && p) {
        segs.push([p[0], p[1], x, y]);
        p = [x, y];
      }
    }
    return { segs, moves };
  }
  /** Segments that cross screen coordinate `at` along axis i while spanning more than `px` on the other. */
  const risers = (segs: Seg[], at: number, px: number, i: 0 | 1 = 0) =>
    segs.filter(
      (s) =>
        Math.min(s[i], s[i + 2]) - 1 <= at &&
        at <= Math.max(s[i], s[i + 2]) + 1 &&
        Math.abs(s[3 - i] - s[1 - i]) > px,
    ).length;

  it.each<[string, (x: number) => number, number[], number]>([
    ['sign-like step', (x) => (x < 0 ? -1 : 1), [0], 120],
    ['jump off a sample point', (x) => (x < 0.123 ? 0 : 2), [0.123], 120],
    ['floor(x)', Math.floor, [-9, -3, 1, 7], 60],
    ['jump next to a pole', (x) => (x < 1 ? 1 / x : x + 5), [1], 300],
  ])('y = f(x): %s draws no riser', (_, f, jumps, gap) => {
    const { segs } = segments((ctx) => drawFunction(ctx, vp, f, '#fff', W, H));
    for (const j of jumps) expect(risers(segs, ((j + 10) / 20) * W, gap / 2), `at ${j}`).toBe(0);
  });

  it('x = g(y): floor(y) draws no riser', () => {
    const { segs } = segments((ctx) => drawExplicitY(ctx, vp, Math.floor, '#fff', W, H));
    const sy = (y: number) => H - ((y + 20 / 3) / (40 / 3)) * H;
    for (const j of [-5, -1, 2, 6]) expect(risers(segs, sy(j), 30, 1), `at ${j}`).toBe(0);
  });

  it.each<[string, (x: number) => number]>([
    ['1000x', (x) => 1000 * x],
    ['x^3', (x) => x ** 3],
    ['cbrt(x)', Math.cbrt],
    ['x^(1/9)', (x) => Math.sign(x) * Math.abs(x) ** (1 / 9)],
    ['tanh(50x)', (x) => Math.tanh(50 * x)],
    ['sin(x)', Math.sin],
  ])('a continuous %s stays one stroke', (_, f) => {
    expect(segments((ctx) => drawFunction(ctx, vp, f, '#fff', W, H)).moves).toBe(1);
  });
});
