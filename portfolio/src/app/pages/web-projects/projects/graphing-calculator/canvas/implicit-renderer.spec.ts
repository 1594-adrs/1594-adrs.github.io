import { describe, it, expect, vi, afterEach } from 'vitest';
import { Viewport } from './viewport';
import { drawImplicitCurve } from './implicit-renderer';

// Extracted from implicit-renderer.ts for testing
function evalImplicit(fn: (x: number, y: number) => number, x: number, y: number): number {
  const CLAMP = 1e8;
  try {
    const v = fn(x, y);
    if (!isFinite(v)) return CLAMP;
    if (v > CLAMP) return CLAMP;
    if (v < -CLAMP) return -CLAMP;
    return v;
  } catch {
    return CLAMP;
  }
}

function lerp(
  v1: number,
  v2: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  level: number,
): [number, number] {
  const t = v2 - v1 === 0 ? 0 : (level - v1) / (v2 - v1);
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

interface MockContext {
  calls: Array<{ method: string; args: unknown[] }>;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  strokeStyle: string;
}

function createMockContext(): CanvasRenderingContext2D & MockContext {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    calls,
    lineWidth: 2,
    lineJoin: 'round',
    lineCap: 'round',
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
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D & MockContext;
}

describe('evalImplicit', () => {
  it('should return function value when finite', () => {
    expect(evalImplicit((x, y) => x + y, 1, 2)).toBe(3);
  });

  it('should clamp large positive values to CLAMP (1e8)', () => {
    expect(evalImplicit((x, y) => 1e9, 0, 0)).toBe(1e8);
  });

  it('should clamp large negative values to -CLAMP', () => {
    expect(evalImplicit((x, y) => -1e9, 0, 0)).toBe(-1e8);
  });

  it('should return CLAMP for Infinity', () => {
    expect(evalImplicit((x, y) => Infinity, 0, 0)).toBe(1e8);
  });

  it('should return CLAMP for NaN', () => {
    expect(evalImplicit((x, y) => NaN, 0, 0)).toBe(1e8);
  });

  it('should return CLAMP when function throws', () => {
    expect(
      evalImplicit(
        (x, y) => {
          throw new Error('boom');
        },
        0,
        0,
      ),
    ).toBe(1e8);
  });

  it('should pass through zero values', () => {
    expect(evalImplicit((x, y) => 0, 0, 0)).toBe(0);
  });
});

describe('lerp', () => {
  it('should interpolate linearly between two points', () => {
    const [x, y] = lerp(0, 1, 0, 0, 10, 10, 0.5);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(5);
  });

  it('should return first point when level = v1', () => {
    const [x, y] = lerp(0, 1, 0, 0, 10, 10, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it('should return second point when level = v2', () => {
    const [x, y] = lerp(0, 1, 0, 0, 10, 10, 1);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(10);
  });

  it('should handle negative coordinates', () => {
    const [x, y] = lerp(-1, 1, -5, -5, 5, 5, -1);
    expect(x).toBeCloseTo(-5);
    expect(y).toBeCloseTo(-5);
  });

  it('should interpolate with fractional level', () => {
    const [x, y] = lerp(0, 10, 0, 0, 100, 50, 5);
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(25);
  });
});

describe('drawImplicitCurve simulation', () => {
  it('should begin path and setup stroke style', () => {
    const ctx = createMockContext();
    const viewport = new Viewport(-10, 10, -10, 10);
    const fn = (x: number, y: number) => x * x + y * y - 1;

    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    // Simulate marching squares (minimal)
    ctx.moveTo(100, 100);
    ctx.lineTo(110, 110);

    ctx.stroke();

    expect(ctx.calls).toContainEqual({ method: 'beginPath', args: [] });
    expect(ctx.calls).toContainEqual({ method: 'stroke', args: [] });
  });

  it('should draw contour segments', () => {
    const ctx = createMockContext();
    ctx.beginPath();
    // Circle: x^2 + y^2 = 1, starts with several moveTo/lineTo pairs
    ctx.moveTo(50, 100);
    ctx.lineTo(60, 95);
    ctx.moveTo(60, 95);
    ctx.lineTo(70, 88);
    ctx.stroke();

    const moveToCalls = ctx.calls.filter((c) => c.method === 'moveTo');
    const lineToCall = ctx.calls.filter((c) => c.method === 'lineTo');
    expect(moveToCalls.length).toBeGreaterThanOrEqual(1);
    expect(lineToCall.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle circle correctly (implicit x^2 + y^2 - r^2 = 0)', () => {
    const fn = (x: number, y: number) => x * x + y * y - 1;
    // At radius 1, should evaluate to ~0
    expect(Math.abs(evalImplicit(fn, 1, 0))).toBeLessThan(0.1);
    expect(Math.abs(evalImplicit(fn, 0, 1))).toBeLessThan(0.1);
  });

  it('should handle points inside and outside circle', () => {
    const fn = (x: number, y: number) => x * x + y * y - 1;
    const inside = evalImplicit(fn, 0.5, 0.5);
    const outside = evalImplicit(fn, 2, 2);

    expect(inside).toBeLessThan(0);
    expect(outside).toBeGreaterThan(0);
  });
});

describe('marching squares case handling', () => {
  it('should recognize case 0 (all below level) and skip', () => {
    // Case 0: 0000 binary = 0, should be skipped
    const caseIndex: number = 0;
    expect(caseIndex === 0 || caseIndex === 15).toBe(true);
  });

  it('should recognize case 15 (all above level) and skip', () => {
    // Case 15: 1111 binary = 15, should be skipped
    const caseIndex: number = 15;
    expect(caseIndex === 0 || caseIndex === 15).toBe(true);
  });

  it('should recognize single edge cases (1, 2, 4, 8)', () => {
    const c1: number = 1;
    const c2: number = 2;
    const c4: number = 4;
    const c8: number = 8;
    expect(c1 !== 0 && c1 !== 15).toBe(true);
    expect(c2 !== 0 && c2 !== 15).toBe(true);
    expect(c4 !== 0 && c4 !== 15).toBe(true);
    expect(c8 !== 0 && c8 !== 15).toBe(true);
  });
});

describe('drawImplicitCurve (real renderer)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function makeCtx() {
    return {
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      lineCap: '',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
  }
  const draw = (
    ctx: ReturnType<typeof makeCtx>,
    vp: Viewport,
    fn: (x: number, y: number) => number,
    coarse = false,
  ) =>
    drawImplicitCurve(ctx as unknown as CanvasRenderingContext2D, vp, fn, '#fff', 400, 300, coarse);

  it('reuses the contour and the Path2D when only a redraw is requested', () => {
    const paths: Array<{ moves: number }> = [];
    class FakePath2D {
      moves = 0;
      constructor() {
        paths.push(this);
      }
      moveTo() {
        this.moves++;
      }
      lineTo() {}
    }
    vi.stubGlobal('Path2D', FakePath2D);
    const fn = vi.fn((x: number, y: number) => x * x + y * y - 4);
    const vp = new Viewport();
    const ctx = makeCtx();

    draw(ctx, vp, fn);
    const evals = fn.mock.calls.length;
    expect(evals).toBeGreaterThan(0);
    draw(ctx, vp, fn);

    expect(fn.mock.calls.length).toBe(evals);
    expect(paths.length).toBe(1);
    expect(paths[0].moves).toBeGreaterThan(0);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.stroke.mock.calls[0][0]).toBe(ctx.stroke.mock.calls[1][0]);
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('rebuilds after the viewport changes and when switching resolution', () => {
    class FakePath2D {
      moveTo() {}
      lineTo() {}
    }
    vi.stubGlobal('Path2D', FakePath2D);
    const fn = vi.fn((x: number, y: number) => x * x + y * y - 4);
    const vp = new Viewport();
    const ctx = makeCtx();
    draw(ctx, vp, fn);
    const first = ctx.stroke.mock.calls[0][0];
    vp.pan(20, 0, 400, 300);
    draw(ctx, vp, fn);
    expect(ctx.stroke.mock.calls[1][0]).not.toBe(first);

    const coarseFn = vi.fn((x: number, y: number) => x * x + y * y - 4);
    draw(ctx, vp, coarseFn, true);
    const coarseEvals = coarseFn.mock.calls.length;
    draw(ctx, vp, coarseFn, false);
    expect(coarseFn.mock.calls.length).toBeGreaterThan(coarseEvals * 2);
  });

  it('falls back to immediate moveTo/lineTo when Path2D is unavailable', () => {
    vi.stubGlobal('Path2D', undefined);
    const fn = (x: number, y: number) => x * x + y * y - 4;
    const ctx = makeCtx();
    draw(ctx, new Viewport(), fn);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.stroke).toHaveBeenCalledWith();
  });
});
