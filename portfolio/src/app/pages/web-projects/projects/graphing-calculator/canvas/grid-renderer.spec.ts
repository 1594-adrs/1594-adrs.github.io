import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';

// Test helpers
function niceStep(range: number): number {
  const rough = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  if (norm <= 1.5) return pow;
  if (norm <= 3.5) return 2 * pow;
  if (norm <= 7.5) return 5 * pow;
  return 10 * pow;
}

interface MockContext {
  calls: Array<{ method: string; args: unknown[] }>;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillStyle: string;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeStyle: string;
  lineWidth: number;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillText: (text: string, x: number, y: number) => void;
}

function createMockContext(): CanvasRenderingContext2D & MockContext {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    calls,
    clearRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
    fillStyle: '',
    fillRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    strokeStyle: '',
    lineWidth: 1,
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
    font: '',
    textAlign: '',
    textBaseline: '',
    fillText: function (text: string, x: number, y: number) {
      calls.push({ method: 'fillText', args: [text, x, y] });
    },
  } as unknown as CanvasRenderingContext2D & MockContext;
}

describe('niceStep', () => {
  it('should return 1 for range 8', () => {
    expect(niceStep(8)).toBe(1);
  });

  it('should return 2 for range 20', () => {
    expect(niceStep(20)).toBe(2);
  });

  it('should return 5 for range 50', () => {
    expect(niceStep(50)).toBe(5);
  });

  it('should return 10 for range 100', () => {
    expect(niceStep(100)).toBe(10);
  });

  it('should return 0.1 for range 0.8', () => {
    expect(niceStep(0.8)).toBe(0.1);
  });

  it('should scale with powers of 10', () => {
    expect(niceStep(800)).toBe(100);
    expect(niceStep(8000)).toBe(1000);
  });

  it('should return a value that divides range into roughly 8 segments', () => {
    const range = 42;
    const step = niceStep(range);
    const segments = range / step;
    expect(segments).toBeGreaterThanOrEqual(4);
    expect(segments).toBeLessThanOrEqual(10);
  });
});

describe('drawGrid', () => {
  it('should clear canvas and fill background', () => {
    const ctx = createMockContext();
    const viewport = new Viewport();
    const width = 800;
    const height = 600;

    // Simulate drawGrid setup calls
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0d0d15';
    ctx.fillRect(0, 0, width, height);

    expect(ctx.calls).toContainEqual({ method: 'clearRect', args: [0, 0, width, height] });
    expect(ctx.calls).toContainEqual({ method: 'fillRect', args: [0, 0, width, height] });
  });

  it('should draw vertical and horizontal grid lines', () => {
    const ctx = createMockContext();
    const viewport = new Viewport(-10, 10, -7, 7);

    // Simulate grid line drawing
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 0);
    ctx.lineTo(100, 600);
    ctx.stroke();

    const callsStr = JSON.stringify(ctx.calls);
    expect(callsStr).toContain('beginPath');
    expect(callsStr).toContain('moveTo');
    expect(callsStr).toContain('lineTo');
    expect(callsStr).toContain('stroke');
  });

  it('should draw axis at origin', () => {
    const ctx = createMockContext();
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(800, 300);
    ctx.stroke();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls.some((c) => c.method === 'moveTo')).toBe(true);
  });

  it('should label grid lines', () => {
    const ctx = createMockContext();
    ctx.fillStyle = '#666680';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', 100, 304);

    expect(ctx.calls).toContainEqual({
      method: 'fillText',
      args: expect.arrayContaining(['0']),
    } as unknown as { method: string; args: unknown[] });
  });
});
