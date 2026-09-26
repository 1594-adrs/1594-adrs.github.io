import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';
import { drawConicCurve } from './conic-renderer';
import { detectConic } from '../engine/conic-detector';
import { parse } from '../engine/parser';
import type { ExpressionNode } from '../engine/parser';

interface RecordedPoint {
  x: number;
  y: number;
}

/** The parser doesn't accept bare `=` (implicit equations are assembled by the
 *  component from two parsed halves) — mirrors conic-detector.spec.ts's helper. */
function parseEquation(expr: string): ExpressionNode {
  const eqIdx = expr.indexOf('=');
  if (eqIdx === -1) throw new Error('No = in equation');
  const lhs = parse(expr.substring(0, eqIdx));
  const rhs = parse(expr.substring(eqIdx + 1));
  return { type: 'BinaryOp', operator: '=', left: lhs, right: rhs };
}

function createRecordingContext(viewport: Viewport, width: number, height: number) {
  const screenPoints: RecordedPoint[] = [];
  const ctx = {
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    beginPath() {},
    moveTo(x: number, y: number) {
      screenPoints.push({ x, y });
    },
    lineTo(x: number, y: number) {
      screenPoints.push({ x, y });
    },
    stroke() {},
  } as unknown as CanvasRenderingContext2D;

  const worldPoints = (): RecordedPoint[] =>
    screenPoints.map(({ x, y }) => {
      const [wx, wy] = viewport.screenToWorld(x, y, width, height);
      return { x: wx, y: wy };
    });

  return { ctx, worldPoints };
}

describe('drawConicCurve', () => {
  const width = 800;
  const height = 600;

  it('samples a circle whose points satisfy x^2 + y^2 = r^2 within tolerance', () => {
    const viewport = new Viewport(-10, 10, -10, 10);
    const conic = detectConic(parseEquation('x^2 + y^2 = 25'))!;
    const { ctx, worldPoints } = createRecordingContext(viewport, width, height);

    const drew = drawConicCurve(ctx, viewport, conic, '#fff', width, height);
    expect(drew).toBe(true);

    const points = worldPoints();
    expect(points.length).toBeGreaterThan(100);
    for (const { x, y } of points) {
      expect(x * x + y * y).toBeCloseTo(25, 1);
    }
  });

  it('samples an off-center ellipse satisfying its equation within tolerance', () => {
    const viewport = new Viewport(-10, 10, -10, 10);
    const conic = detectConic(parseEquation('(x-2)^2/9 + (y+1)^2/4 = 1'))!;
    const { ctx, worldPoints } = createRecordingContext(viewport, width, height);

    drawConicCurve(ctx, viewport, conic, '#fff', width, height);

    const points = worldPoints();
    expect(points.length).toBeGreaterThan(100);
    for (const { x, y } of points) {
      const lhs = ((x - 2) * (x - 2)) / 9 + ((y + 1) * (y + 1)) / 4;
      expect(lhs).toBeCloseTo(1, 1);
    }
  });

  it('samples a vertical parabola satisfying y = (x-h)^2/(4p) + k', () => {
    const viewport = new Viewport(-10, 10, -10, 10);
    const conic = detectConic(parseEquation('y = x^2'))!;
    const { ctx, worldPoints } = createRecordingContext(viewport, width, height);

    drawConicCurve(ctx, viewport, conic, '#fff', width, height);

    const points = worldPoints();
    expect(points.length).toBeGreaterThan(100);
    for (const { x, y } of points) {
      expect(y).toBeCloseTo(x * x, 1);
    }
  });

  it('samples both hyperbola branches satisfying x^2/a^2 - y^2/b^2 = 1', () => {
    const viewport = new Viewport(-10, 10, -10, 10);
    const conic = detectConic(parseEquation('x^2/4 - y^2/9 = 1'))!;
    const { ctx, worldPoints } = createRecordingContext(viewport, width, height);

    drawConicCurve(ctx, viewport, conic, '#fff', width, height);

    const points = worldPoints();
    expect(points.length).toBeGreaterThan(100);
    let sawPositiveBranch = false;
    let sawNegativeBranch = false;
    for (const { x, y } of points) {
      expect(x * x - (y * y * 4) / 9).toBeCloseTo(4, 0);
      if (x > 0) sawPositiveBranch = true;
      if (x < 0) sawNegativeBranch = true;
    }
    expect(sawPositiveBranch).toBe(true);
    expect(sawNegativeBranch).toBe(true);
  });

  it('returns false for a degenerate conic (zero radius) without drawing', () => {
    const viewport = new Viewport(-10, 10, -10, 10);
    const conic = detectConic(parseEquation('x^2 + y^2 = 0'))!;
    const { ctx, worldPoints } = createRecordingContext(viewport, width, height);

    const drew = drawConicCurve(ctx, viewport, conic, '#fff', width, height);
    expect(drew).toBe(false);
    expect(worldPoints().length).toBe(0);
  });
});
