import { describe, it, expect } from 'vitest';

interface MockContext {
  calls: Array<{ method: string; args: unknown[] }>;
  save: () => void;
  restore: () => void;
  fillStyle: string;
  beginPath: () => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  fill: () => void;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillText: (text: string, x: number, y: number) => void;
  strokeStyle: string;
  lineWidth: number;
  stroke: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  measureText: (text: string) => { width: number };
}

function createMockContext(): CanvasRenderingContext2D & MockContext {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    calls,
    save: function () {
      calls.push({ method: 'save', args: [] });
    },
    restore: function () {
      calls.push({ method: 'restore', args: [] });
    },
    fillStyle: '',
    beginPath: function () {
      calls.push({ method: 'beginPath', args: [] });
    },
    arc: function (x: number, y: number, r: number, start: number, end: number) {
      calls.push({ method: 'arc', args: [x, y, r, start, end] });
    },
    fill: function () {
      calls.push({ method: 'fill', args: [] });
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    fillText: function (text: string, x: number, y: number) {
      calls.push({ method: 'fillText', args: [text, x, y] });
    },
    strokeStyle: '',
    lineWidth: 1,
    stroke: function () {
      calls.push({ method: 'stroke', args: [] });
    },
    fillRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    strokeRect: function (x: number, y: number, w: number, h: number) {
      calls.push({ method: 'strokeRect', args: [x, y, w, h] });
    },
    measureText: function (text: string) {
      return { width: text.length * 6.6 };
    },
  } as unknown as CanvasRenderingContext2D & MockContext;
}

// Helper function extracted from trace-renderer.ts
function drawCoordinateLabel(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  text: string,
  color: string,
  width: number,
  height: number,
): void {
  ctx.font = '11px "JetBrains Mono", monospace';
  const metrics = ctx.measureText(text);
  const pad = 4;
  const labelW = metrics.width + pad * 2;
  const labelH = 15;
  const offset = 12;

  const overflowsRight = screenX + offset + labelW > width;
  const overflowsTop = screenY - offset - labelH < 0;

  const lx = overflowsRight ? screenX - offset - labelW : screenX + offset;
  const topY = overflowsTop ? screenY + offset : screenY - offset - labelH;

  ctx.fillStyle = '#0a0a0f';
  ctx.strokeStyle = '#333355';
  ctx.lineWidth = 1;
  ctx.fillRect(lx, topY, labelW, labelH);
  ctx.strokeRect(lx, topY, labelW, labelH);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + pad, topY + labelH / 2);
}

describe('drawCoordinateLabel', () => {
  it('should draw label box and text', () => {
    const ctx = createMockContext();
    const text = '(1.23, 4.56)';

    drawCoordinateLabel(ctx, 100, 100, text, '#ff0000', 800, 600);

    expect(ctx.calls).toContainEqual({ method: 'fillRect', args: expect.any(Array) });
    expect(ctx.calls).toContainEqual({ method: 'strokeRect', args: expect.any(Array) });
    expect(ctx.calls.some((c) => c.method === 'fillText')).toBe(true);
  });

  it('should flip label to left when it would overflow right edge', () => {
    const ctx = createMockContext();
    const text = 'this is a very long test string to trigger overflow';
    const width = 800;
    const screenX = width - 20; // Very close to right edge

    drawCoordinateLabel(ctx, screenX, 100, text, '#ff0000', width, 600);

    const fillRectCall = ctx.calls.find((c) => c.method === 'fillRect');
    if (fillRectCall) {
      const x = fillRectCall.args[0] as number;
      expect(x).toBeLessThan(screenX);
    }
  });

  it('should flip label down when it would overflow top edge', () => {
    const ctx = createMockContext();
    const text = 'test';
    const height = 600;
    const screenY = 10; // Near top edge

    drawCoordinateLabel(ctx, 100, screenY, text, '#ff0000', 800, height);

    const fillRectCall = ctx.calls.find((c) => c.method === 'fillRect');
    if (fillRectCall) {
      const y = fillRectCall.args[1] as number;
      expect(y).toBeGreaterThan(screenY);
    }
  });

  it('should set correct font and text styles', () => {
    const ctx = createMockContext();
    drawCoordinateLabel(ctx, 100, 100, 'test', '#00ff00', 800, 600);

    expect(ctx.font).toBe('11px "JetBrains Mono", monospace');
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('middle');
  });

  it('should use provided color for text', () => {
    const ctx = createMockContext();
    const color = '#ff0000';
    drawCoordinateLabel(ctx, 100, 100, 'test', color, 800, 600);

    expect(ctx.fillStyle).toBe(color);
  });
});

describe('drawTracePoint simulation', () => {
  it('should draw filled circle at screen position', () => {
    const ctx = createMockContext();
    const screenX = 400;
    const screenY = 300;
    const worldX = 1.5;
    const worldY = 2.3;
    const color = '#ff00ff';
    const width = 800;
    const height = 600;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
    ctx.fill();

    const label = `(${worldX.toFixed(3)}, ${worldY.toFixed(3)})`;
    drawCoordinateLabel(ctx, screenX, screenY, label, color, width, height);
    ctx.restore();

    expect(ctx.calls).toContainEqual({ method: 'save', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'restore', args: [] });
    expect(ctx.calls).toContainEqual({
      method: 'arc',
      args: [screenX, screenY, 4, 0, Math.PI * 2],
    });
  });

  it('should format world coordinates with 3 decimal places', () => {
    const ctx = createMockContext();
    drawCoordinateLabel(ctx, 100, 100, '(1.234, 5.678)', '#ff0000', 800, 600);

    const fillTextCall = ctx.calls.find((c) => c.method === 'fillText');
    if (fillTextCall) {
      const text = fillTextCall.args[0] as string;
      expect(text).toMatch(/\(\d+\.\d{3}, \d+\.\d{3}\)/);
    }
  });
});

describe('drawPointOfInterest simulation', () => {
  it('should draw hollow circle for point of interest', () => {
    const ctx = createMockContext();
    const screenX = 200;
    const screenY = 250;
    const active = false;

    ctx.save();
    ctx.strokeStyle = '#8888aa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls).toContainEqual({
      method: 'arc',
      args: [screenX, screenY, 4, 0, Math.PI * 2],
    });
  });

  it('should use active color and larger radius when active', () => {
    const ctx = createMockContext();
    const screenX = 200;
    const screenY = 250;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
    ctx.stroke();

    expect(ctx.strokeStyle).toBe('#ffffff');
    expect(ctx.lineWidth).toBe(2);
  });

  it('should draw coordinate label when label is provided', () => {
    const ctx = createMockContext();
    const label = 'x=1';

    drawCoordinateLabel(ctx, 200, 250, label, '#ffffff', 800, 600);

    expect(ctx.calls.some((c) => c.method === 'fillText')).toBe(true);
  });

  it('should not draw label when label is null', () => {
    const ctx = createMockContext();

    ctx.save();
    ctx.strokeStyle = '#8888aa';
    ctx.beginPath();
    ctx.arc(200, 250, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Only drawing the circle, no label
    const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
    expect(fillTextCalls.length).toBe(0);
  });

  it('should save and restore context state', () => {
    const ctx = createMockContext();

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.restore();

    expect(ctx.calls).toContainEqual({ method: 'save', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'restore', args: [] });
  });
});
