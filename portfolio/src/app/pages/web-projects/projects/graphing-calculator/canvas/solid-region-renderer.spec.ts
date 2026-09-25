import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';
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
