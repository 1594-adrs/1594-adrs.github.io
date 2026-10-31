import { afterEach, describe, expect, it } from 'vitest';
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  contrastOnWhite,
  darkenForWhite,
  paletteFor,
  setCanvasPalette,
} from './palette';
import { FUNCTION_COLORS } from '../utils/color';
import { drawGrid } from './grid-renderer';
import { drawAsymptote } from './graph-renderer';
import { Viewport } from './viewport';

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

describe('paletteFor', () => {
  it('maps each theme to its palette', () => {
    expect(paletteFor('dark')).toBe(DARK_PALETTE);
    expect(paletteFor('light')).toBe(LIGHT_PALETTE);
  });

  it('gives the light palette a white page with dark, readable ink', () => {
    expect(LIGHT_PALETTE.background).toBe('#ffffff');
    expect(LIGHT_PALETTE.scene.background).toBe(0xffffff);
    for (const ink of [LIGHT_PALETTE.axis, LIGHT_PALETTE.tickLabel, LIGHT_PALETTE.ink]) {
      expect(contrastOnWhite(ink)).toBeGreaterThanOrEqual(7);
    }
    expect(contrastOnWhite(LIGHT_PALETTE.muted)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnWhite(LIGHT_PALETTE.highlight)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the revolution axis distinct from the coordinate axes', () => {
    for (const p of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(p.revolutionAxisLine.slice(0, 7)).not.toBe(p.axis);
    }
  });
});

describe('darkenForWhite', () => {
  it('brings every default curve colour to AA contrast on white', () => {
    for (const color of FUNCTION_COLORS) {
      expect(contrastOnWhite(LIGHT_PALETTE.curve(color))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the hue: channels are scaled by one factor', () => {
    const [r, g, b] = rgb(darkenForWhite('#ff6b35'));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(g / r).toBeCloseTo(0x6b / 0xff, 1);
  });

  it('only darkens as far as needed', () => {
    const out = darkenForWhite('#00ff88');
    expect(contrastOnWhite(out)).toBeLessThan(5);
  });

  it('leaves passing and non-hex colours alone', () => {
    expect(darkenForWhite('#1D2129')).toBe('#1d2129');
    expect(darkenForWhite('rgb(0, 255, 0)')).toBe('rgb(0, 255, 0)');
  });

  it('returns 6-digit hex so renderers can append an alpha byte', () => {
    expect(LIGHT_PALETTE.curve('#b6ff3c')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('drawGrid in the light palette', () => {
  afterEach(() => setCanvasPalette(DARK_PALETTE));

  function recordingContext() {
    const fills: Array<{ op: string; style: string; font?: string }> = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return () => ({ width: 10 });
        return () => {
          if (key === 'fillRect' || key === 'fillText' || key === 'stroke') {
            const style = key === 'stroke' ? target['strokeStyle'] : target['fillStyle'];
            fills.push({ op: String(key), style: String(style), font: target['font'] as string });
          }
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, fills };
  }

  it('paints white paper, dark axes and heavier tick labels', () => {
    setCanvasPalette(LIGHT_PALETTE);
    const { ctx, fills } = recordingContext();
    drawGrid(ctx, new Viewport(), 400, 300);
    expect(fills[0]).toMatchObject({ op: 'fillRect', style: '#ffffff' });
    expect(fills.some((f) => f.op === 'stroke' && f.style === LIGHT_PALETTE.axis)).toBe(true);
    const label = fills.find((f) => f.op === 'fillText');
    expect(label).toMatchObject({ style: LIGHT_PALETTE.tickLabel, font: LIGHT_PALETTE.tickFont });
  });

  it('draws asymptotes in the active palette', () => {
    setCanvasPalette(LIGHT_PALETTE);
    const { ctx, fills } = recordingContext();
    drawAsymptote(ctx, new Viewport(), { type: 'vertical', equation: 'x = 0', value: 0 }, 400, 300);
    expect(fills.find((f) => f.op === 'stroke')?.style).toBe(LIGHT_PALETTE.muted);
  });
});
