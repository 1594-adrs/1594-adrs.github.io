import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport';
import {
  drawLabelBlock,
  drawLimitMarker,
  drawNewtonSteps,
  drawTangentOverlay,
  lineScreenSegment,
  subscriptX,
} from './calculus-renderer';

type Call = { method: string; args: unknown[] };

/** Records every method call on a 2D context; property writes are kept as plain fields. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (t: string) => ({ width: t.length * 7 });
      return (...args: unknown[]) => calls.push({ method: key, args });
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const texts = (calls: Call[]) => calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
const W = 800;
const H = 560;

describe('calculus-renderer', () => {
  const vp = new Viewport(-10, 10, -7, 7);

  it('spans the viewport with a sloped line, a vertical one for ±∞, none for NaN', () => {
    const seg = lineScreenSegment(vp, 0, 0, 1, W, H)!;
    expect(seg[0]).toBeCloseTo(0);
    expect(seg[2]).toBeCloseTo(W);
    expect(seg[1]).toBeGreaterThan(seg[3]); // rising line: screen y decreases
    const v = lineScreenSegment(vp, 2, 0, Infinity, W, H)!;
    expect(v[0]).toBe(v[2]);
    expect([v[1], v[3]]).toEqual([0, H]);
    expect(lineScreenSegment(vp, 0, 0, NaN, W, H)).toBeNull();
  });

  it('writes one text line per label line, first in the curve color', () => {
    const { ctx, calls } = recorder();
    drawLabelBlock(ctx, 100, 100, ['(1, 1)', 'm = 2', 'y = 2x - 1'], '#00ff88', W, H);
    expect(texts(calls)).toEqual(['(1, 1)', 'm = 2', 'y = 2x - 1']);
  });

  it('draws no line for a derivative that does not exist, only the readout', () => {
    const { ctx, calls } = recorder();
    drawTangentOverlay(
      ctx,
      vp,
      { kind: 'dne', x: 0, y: 0, slope: NaN, lines: ['(0, 0)', 'slope does not exist'] },
      [400, 280],
      '#00ff88',
      true,
      W,
      H,
    );
    expect(calls.some((c) => c.method === 'lineTo')).toBe(false);
    expect(texts(calls)).toContain('slope does not exist');
  });

  it('draws tangent and normal lines when requested', () => {
    const { ctx, calls } = recorder();
    const overlay = { kind: 'finite' as const, x: 1, y: 1, slope: 2, lines: ['(1, 1)'] };
    drawTangentOverlay(ctx, vp, overlay, [0, 0], '#00ff88', false, W, H);
    expect(calls.filter((c) => c.method === 'lineTo')).toHaveLength(1);
    const withNormal = recorder();
    drawTangentOverlay(withNormal.ctx, vp, overlay, [0, 0], '#00ff88', true, W, H);
    expect(withNormal.calls.filter((c) => c.method === 'lineTo')).toHaveLength(2);
  });

  it('marks a finite limit with a ring and label, an infinite one with an edge arrow', () => {
    const finite = recorder();
    drawLimitMarker(finite.ctx, vp, { x0: 0, value: 1, text: '1', color: '#0f8' }, W, H);
    expect(finite.calls.some((c) => c.method === 'arc')).toBe(true);
    expect(texts(finite.calls)).toEqual(['L = 1']);
    const inf = recorder();
    drawLimitMarker(inf.ctx, vp, { x0: 0, value: Infinity, text: '∞', color: '#0f8' }, W, H);
    expect(texts(inf.calls)).toEqual(['↑ L = ∞']);
    const atInf = recorder();
    drawLimitMarker(atInf.ctx, vp, { x0: Infinity, value: Math.E, text: 'e', color: '#0f8' }, W, H);
    expect(texts(atInf.calls)).toEqual(['L = e', 'as x → ∞']);
  });

  it('draws one tangent segment per Newton step and subscripts the labels', () => {
    const { ctx, calls } = recorder();
    const rows = [
      { n: 0, x: 1, fx: -1 },
      { n: 1, x: 1.5, fx: 0.25 },
      { n: 2, x: 1.4167, fx: 0.0069 },
    ];
    drawNewtonSteps(ctx, vp, rows, '#0f8', W, H);
    // 2 tangent segments + 2 verticals back to the curve + the x0 vertical.
    expect(calls.filter((c) => c.method === 'lineTo')).toHaveLength(5);
    expect(texts(calls)).toContain('x₀');
    expect(subscriptX(12)).toBe('x₁₂');
  });

  it('stops drawing Newton steps at the first undefined iterate', () => {
    const { ctx, calls } = recorder();
    drawNewtonSteps(ctx, vp, [{ n: 0, x: NaN, fx: NaN }], '#0f8', W, H);
    expect(calls.some((c) => c.method === 'lineTo')).toBe(false);
  });
});
