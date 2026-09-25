import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';
import { findNearestCurvePoint } from './curve-locator';

describe('findNearestCurvePoint', () => {
  const viewport = new Viewport(-10, 10, -7, 7);
  const width = 800;
  const height = 560;

  it('snaps to a nearby explicit curve (y = x)', () => {
    const curves = [
      { index: 0, color: '#00ff88', mode: 'explicit' as const, fn: (x: number) => x },
    ];
    const [sx, sy] = viewport.worldToScreen(2, 2, width, height);
    const result = findNearestCurvePoint(curves, sx + 2, sy - 1, viewport, width, height, 12);
    expect(result).not.toBeNull();
    expect(result!.curveIndex).toBe(0);
    expect(result!.worldX).toBeCloseTo(2, 0);
    expect(result!.worldY).toBeCloseTo(2, 0);
  });

  it('returns null when nothing is within the threshold', () => {
    const curves = [
      { index: 0, color: '#00ff88', mode: 'explicit' as const, fn: (x: number) => x },
    ];
    const result = findNearestCurvePoint(curves, 10, 10, viewport, width, height, 12);
    expect(result).toBeNull();
  });

  it('snaps to an explicit-y curve (x = y)', () => {
    const curves = [
      { index: 1, color: '#ff6b35', mode: 'explicit-y' as const, fn: (y: number) => y },
    ];
    const [sx, sy] = viewport.worldToScreen(-3, -3, width, height);
    const result = findNearestCurvePoint(curves, sx - 1, sy + 2, viewport, width, height, 12);
    expect(result).not.toBeNull();
    expect(result!.curveIndex).toBe(1);
    expect(result!.worldX).toBeCloseTo(-3, 0);
  });

  it('picks the closer of two overlapping curves', () => {
    const curves = [
      { index: 0, color: '#00ff88', mode: 'explicit' as const, fn: (x: number) => x },
      { index: 1, color: '#ff6b35', mode: 'explicit' as const, fn: (x: number) => x + 0.05 },
    ];
    const [sx, sy] = viewport.worldToScreen(1, 1.05, width, height);
    const result = findNearestCurvePoint(curves, sx, sy, viewport, width, height, 12);
    expect(result).not.toBeNull();
    expect(result!.curveIndex).toBe(1);
  });
});
