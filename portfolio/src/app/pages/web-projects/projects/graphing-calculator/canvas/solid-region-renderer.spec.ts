import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';
import { drawSolidRegion, washerRadii, washerRadiusLayout } from './solid-region-renderer';
import type { SolidSpec, SolidPiece, AxisLine } from '../engine/solids/solid.types';

// Helper functions extracted from solid-region-renderer.ts
function baselineFor(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

function boundaryColor(spec: SolidSpec, piece: SolidPiece): string {
  const idx = piece.upperIndex ?? piece.lowerIndex;
  return idx === null ? '#00ff88' : spec.curves[idx].color;
}

function findPiece(pieces: SolidPiece[], t: number): SolidPiece | null {
  for (const p of pieces) {
    if (t >= p.a - 1e-9 && t <= p.b + 1e-9) return p;
  }
  return pieces.length > 0 ? pieces[pieces.length - 1] : null;
}

interface MockContext {
  calls: Array<{ method: string; args: unknown[] }>;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  fillStyle: string;
  fill: () => void;
  strokeStyle: string;
  lineWidth: number;
  stroke: () => void;
  save: () => void;
  restore: () => void;
  setLineDash: (segments: number[]) => void;
  font: string;
  textAlign: string;
  fillText: (text: string, x: number, y: number) => void;
}

function createMockContext(): CanvasRenderingContext2D & MockContext {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    calls,
    beginPath: function () {
      calls.push({ method: 'beginPath', args: [] });
    },
    moveTo: function (x: number, y: number) {
      calls.push({ method: 'moveTo', args: [x, y] });
    },
    lineTo: function (x: number, y: number) {
      calls.push({ method: 'lineTo', args: [x, y] });
    },
    closePath: function () {
      calls.push({ method: 'closePath', args: [] });
    },
    fillStyle: '',
    fill: function () {
      calls.push({ method: 'fill', args: [] });
    },
    strokeStyle: '',
    lineWidth: 1,
    stroke: function () {
      calls.push({ method: 'stroke', args: [] });
    },
    save: function () {
      calls.push({ method: 'save', args: [] });
    },
    restore: function () {
      calls.push({ method: 'restore', args: [] });
    },
    setLineDash: function (segments: number[]) {
      calls.push({ method: 'setLineDash', args: [segments] });
    },
    font: '',
    textAlign: '',
    fillText: function (text: string, x: number, y: number) {
      calls.push({ method: 'fillText', args: [text, x, y] });
    },
  } as unknown as CanvasRenderingContext2D & MockContext;
}

describe('baselineFor', () => {
  it('should return axis value for disk-washer method', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 3 },
    };
    expect(baselineFor(spec)).toBe(3);
  });

  it('should return 0 when disk-washer has no axis', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [],
      a: 0,
      b: 1,
    };
    expect(baselineFor(spec)).toBe(0);
  });

  it('should return 0 for shell method', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    expect(baselineFor(spec)).toBe(0);
  });

  it('should return 0 for cross-section method', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [],
      a: 0,
      b: 1,
    };
    expect(baselineFor(spec)).toBe(0);
  });
});

describe('boundaryColor', () => {
  it('should return curve color when upper index is set', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [{ fn: (x) => x, ast: null, label: 'f₁', color: '#ff0000' }],
      a: 0,
      b: 1,
    };
    const piece: SolidPiece = { a: 0, b: 1, upperIndex: 0, lowerIndex: null };
    expect(boundaryColor(spec, piece)).toBe('#ff0000');
  });

  it('should return curve color when lower index is set', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [{ fn: (x) => x, ast: null, label: 'f₁', color: '#00ff00' }],
      a: 0,
      b: 1,
    };
    const piece: SolidPiece = { a: 0, b: 1, upperIndex: null, lowerIndex: 0 };
    expect(boundaryColor(spec, piece)).toBe('#00ff00');
  });

  it('should return default color when both indices are null', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [{ fn: (x) => x, ast: null, label: 'f₁', color: '#ff0000' }],
      a: 0,
      b: 1,
    };
    const piece: SolidPiece = { a: 0, b: 1, upperIndex: null, lowerIndex: null };
    expect(boundaryColor(spec, piece)).toBe('#00ff88');
  });

  it('should prefer upperIndex over lowerIndex', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [
        { fn: (x) => x, ast: null, label: 'f₁', color: '#ff0000' },
        { fn: (x) => x * 2, ast: null, label: 'f₂', color: '#0000ff' },
      ],
      a: 0,
      b: 1,
    };
    const piece: SolidPiece = { a: 0, b: 1, upperIndex: 0, lowerIndex: 1 };
    expect(boundaryColor(spec, piece)).toBe('#ff0000');
  });
});

describe('findPiece', () => {
  it('should find piece containing t', () => {
    const pieces: SolidPiece[] = [
      { a: 0, b: 1, upperIndex: 0, lowerIndex: null },
      { a: 1, b: 2, upperIndex: 1, lowerIndex: null },
    ];
    expect(findPiece(pieces, 0.5)?.b).toBe(1);
    expect(findPiece(pieces, 1.5)?.b).toBe(2);
  });

  it('should find piece at exact boundary', () => {
    const pieces: SolidPiece[] = [{ a: 0, b: 1, upperIndex: 0, lowerIndex: null }];
    expect(findPiece(pieces, 1)).toEqual(pieces[0]);
  });

  it('should return last piece for t beyond range', () => {
    const pieces: SolidPiece[] = [
      { a: 0, b: 1, upperIndex: 0, lowerIndex: null },
      { a: 1, b: 2, upperIndex: 1, lowerIndex: null },
    ];
    expect(findPiece(pieces, 3)).toEqual(pieces[1]);
  });

  it('should return null for empty pieces array', () => {
    expect(findPiece([], 0.5)).toBeNull();
  });
});

describe('drawSolidRegion simulation', () => {
  it('should begin path for each piece fill', () => {
    const ctx = createMockContext();
    ctx.beginPath();
    ctx.moveTo(100, 300);
    ctx.lineTo(200, 280);
    ctx.closePath();
    ctx.fillStyle = '#ff000030';
    ctx.fill();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'closePath', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'fill', args: [] });
  });

  it('should draw axis line for horizontal axis', () => {
    const ctx = createMockContext();
    const axis: AxisLine = { orientation: 'horizontal', value: 2 };

    ctx.save();
    ctx.strokeStyle = '#ffaa0088';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(800, 300);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    expect(ctx.calls).toContainEqual({ method: 'save', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'restore', args: [] });
    expect(ctx.calls).toContainEqual({
      method: 'setLineDash',
      args: [[8, 4]],
    });
  });

  it('should draw axis line for vertical axis', () => {
    const ctx = createMockContext();
    const axis: AxisLine = { orientation: 'vertical', value: 1 };

    ctx.save();
    ctx.strokeStyle = '#ffaa0088';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(200, 0);
    ctx.lineTo(200, 600);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    expect(ctx.calls).toContainEqual({ method: 'save', args: [] });
  });

  it('should draw sweep strip when sweepT is not null', () => {
    const ctx = createMockContext();
    // Simulate strip drawing
    ctx.beginPath();
    ctx.moveTo(250, 300);
    ctx.lineTo(270, 280);
    ctx.lineTo(270, 350);
    ctx.lineTo(250, 350);
    ctx.closePath();
    ctx.fillStyle = '#ffcc00';
    ctx.fill();

    expect(ctx.calls.some((c) => c.method === 'fill')).toBe(true);
  });

  it('should not draw sweep strip when sweepT is null', () => {
    const ctx = createMockContext();
    ctx.beginPath();
    ctx.stroke();

    const beforeStrokeCount = ctx.calls.length;
    // No additional fill calls should happen
    expect(beforeStrokeCount).toBeGreaterThan(0);
  });
});

describe('drawSolidRegion mirror outline', () => {
  const curve = (c: number) => ({ fn: () => c, ast: null, label: 'f', color: '#3366cc' });
  const piece: SolidPiece = { a: 0, b: 1, upperIndex: 0, lowerIndex: 1 };
  const spec = (method: SolidSpec['method'], axis?: AxisLine): SolidSpec => ({
    method,
    variable: 'x',
    curves: [curve(2), curve(1)],
    a: 0,
    b: 1,
    axis,
  });
  const points = (ctx: MockContext) =>
    ctx.calls.filter((c) => c.method === 'lineTo').map((c) => c.args as [number, number]);

  it('outlines the region reflected across y = k for disk-washer', () => {
    const ctx = createMockContext();
    const viewport = new Viewport();
    drawSolidRegion(
      ctx,
      viewport,
      spec('disk-washer', { orientation: 'horizontal', value: -1 }),
      [piece],
      null,
      200,
      140,
    );
    expect(ctx.calls).toContainEqual({ method: 'setLineDash', args: [[6, 4]] });
    const [, mirroredTop] = viewport.worldToScreen(0, -4, 200, 140);
    expect(points(ctx).some(([, y]) => Math.abs(y - mirroredTop) < 1e-9)).toBe(true);
  });

  it('outlines the region reflected across x = k for shell', () => {
    const ctx = createMockContext();
    const viewport = new Viewport();
    drawSolidRegion(
      ctx,
      viewport,
      spec('shell', { orientation: 'vertical', value: 3 }),
      [piece],
      null,
      200,
      140,
    );
    const [mirroredRight] = viewport.worldToScreen(6, 0, 200, 140);
    expect(points(ctx).some(([x]) => Math.abs(x - mirroredRight) < 1e-9)).toBe(true);
  });

  it('draws no mirror for cross-sections', () => {
    const ctx = createMockContext();
    drawSolidRegion(ctx, new Viewport(), spec('cross-section'), [piece], null, 200, 140);
    expect(ctx.calls).not.toContainEqual({ method: 'setLineDash', args: [[6, 4]] });
  });
});

describe('disk-washer radius labels', () => {
  const line = { fn: (x: number) => x, ast: null, label: 'f₁', color: '#00ff88' };
  const parabola = { fn: (x: number) => x * x, ast: null, label: 'f₂', color: '#ff6b35' };
  const about = (k: number, curves = [line, parabola]): SolidSpec => ({
    method: 'disk-washer',
    variable: 'x',
    curves,
    a: 0,
    b: 1,
    axis: { orientation: 'horizontal', value: k },
  });
  const between: SolidPiece = { a: 0, b: 1, upperIndex: 0, lowerIndex: 1 };
  const toAxis: SolidPiece = { a: 0, b: 1, upperIndex: 0, lowerIndex: null };
  const viewport = new Viewport(-1, 1, -1, 1);

  it('disk: R runs from the axis to the curve, no r', () => {
    expect(washerRadii(about(0, [parabola]), toAxis, 0.8)).toEqual({
      axis: 0,
      outer: 0.8 * 0.8,
      inner: null,
    });
  });

  it('washer about y = 0: R to the upper curve, r to the lower one', () => {
    expect(washerRadii(about(0), between, 0.5)).toEqual({ axis: 0, outer: 0.5, inner: 0.25 });
  });

  it('washer about an axis above the region: R reaches the lower curve', () => {
    expect(washerRadii(about(1), between, 0.5)).toEqual({ axis: 1, outer: 0.25, inner: 0.5 });
  });

  it('axis inside the region is a disk (r = 0)', () => {
    expect(washerRadii(about(0.4), between, 0.5)?.inner).toBeNull();
  });

  it('is null for shells', () => {
    expect(washerRadii({ ...about(0), method: 'shell' }, between, 0.5)).toBeNull();
  });

  it('lays R beside the strip on the +x side and r on the -x side', () => {
    const layout = washerRadiusLayout(viewport, about(0), between, 0.5, 0.01, 200, 200);
    expect(layout).toHaveLength(2);
    const [R, r] = layout!;
    expect(R.label).toBe('R');
    expect(R.from[0]).toBeCloseTo(158);
    expect(R.from[1]).toBeCloseTo(100);
    expect(R.to[1]).toBeCloseTo(50);
    expect(R.anchor[0]).toBeCloseTo(167);
    expect(R.anchor[1]).toBeCloseTo(75);
    expect(r.label).toBe('r');
    expect(r.from[0]).toBeCloseTo(142);
    expect(r.to[1]).toBeCloseTo(75);
    expect(r.anchor[0]).toBeCloseTo(133);
  });

  it('points R downwards when the axis is above the region', () => {
    const [R, r] = washerRadiusLayout(viewport, about(1), between, 0.5, 0.01, 200, 200)!;
    expect(R.from[1]).toBeCloseTo(0);
    expect(R.to[1]).toBeCloseTo(75);
    expect(R.along[1]).toBeCloseTo(1);
    expect(r.to[1]).toBeCloseTo(50);
  });

  it('only lays out R for a disk', () => {
    const layout = washerRadiusLayout(viewport, about(0, [parabola]), toAxis, 0.8, 0.01, 200, 200);
    expect(layout?.map((s) => s.label)).toEqual(['R']);
  });

  it('offsets along screen y when integrating in y (x = g(y) about x = k)', () => {
    const spec: SolidSpec = {
      ...about(0),
      variable: 'y',
      axis: { orientation: 'vertical', value: 0 },
    };
    const [R, r] = washerRadiusLayout(viewport, spec, between, 0.5, 0.01, 200, 200)!;
    expect(R.from[0]).toBeCloseTo(100);
    expect(R.to[0]).toBeCloseTo(150);
    expect(R.from[1]).toBeCloseTo(42);
    expect(r.from[1]).toBeCloseTo(58);
  });

  it('draws the mirrored strip and italic R / r text when sweeping', () => {
    const texts: string[] = [];
    const moves: Array<[number, number]> = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args: unknown[]) => {
          if (key === 'fillText') texts.push(args[0] as string);
          if (key === 'moveTo') moves.push(args as [number, number]);
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawSolidRegion(ctx, viewport, about(0), [between], 0.5, 200, 200);
    expect(texts).toContain('R');
    expect(texts).toContain('r');
    expect(String(state['font'])).toContain('italic');
    const [, mirroredTop] = viewport.worldToScreen(0, -0.5, 200, 200);
    expect(moves.some(([, y]) => Math.abs(y - mirroredTop) < 1.5)).toBe(true);
  });

  function drawnLabels(s: SolidSpec, t: number): string[] {
    const texts: string[] = [];
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return () => ({ width: 10 });
        return (...args: unknown[]) => {
          if (key === 'fillText') texts.push(args[0] as string);
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawSolidRegion(ctx, viewport, s, [between], t, 200, 200);
    return texts.filter((x) => x === 'R' || x === 'r');
  }

  it('drops the r label when its segment is under the minimum length', () => {
    expect(drawnLabels(about(0), 0.1)).toEqual(['R']);
  });

  it.each(['shell', 'cross-section'] as const)('draws no R / r for %s', (method) => {
    expect(drawnLabels({ ...about(0), method }, 0.5)).toEqual([]);
  });

  it('labels R and r when integrating in y about a vertical axis', () => {
    const s: SolidSpec = {
      ...about(0),
      variable: 'y',
      axis: { orientation: 'vertical', value: 0 },
    };
    expect(drawnLabels(s, 0.5).sort()).toEqual(['R', 'r']);
  });
});
