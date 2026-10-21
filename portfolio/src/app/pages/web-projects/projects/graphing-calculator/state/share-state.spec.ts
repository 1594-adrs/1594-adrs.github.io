import { describe, it, expect } from 'vitest';
import {
  buildShareHash,
  extractShareFragment,
  parseShareState,
  serializeShareState,
  SHARE_STATE_VERSION,
  type ShareState,
} from './share-state';

function makeState(): ShareState {
  return {
    v: SHARE_STATE_VERSION,
    functions: [
      { raw: 'sin(x)', color: '#00ff88', visible: true },
      { raw: 'x^2', color: '#ff6b35', visible: false },
    ],
    viewport: { xMin: -10, xMax: 10, yMin: -7, yMax: 7 },
    tool: {
      active: 'integral',
      integral: { fnIndex: 0, a: -2, b: 2 },
    },
  };
}

describe('share-state', () => {
  it('round-trips serialize/parse', () => {
    const state = makeState();
    const encoded = serializeShareState(state);
    const parsed = parseShareState(encoded);
    expect(parsed).toEqual(state);
  });

  it('round-trips via the #s= hash fragment', () => {
    const state = makeState();
    const hash = buildShareHash(state);
    expect(hash.startsWith('#s=')).toBe(true);
    const fragment = extractShareFragment(hash);
    expect(fragment).not.toBeNull();
    const parsed = parseShareState(fragment!);
    expect(parsed).toEqual(state);
  });

  it('handles unicode expressions (e.g. theta) round-trip', () => {
    const state = makeState();
    state.functions[0].raw = 'r=cos(3*θ)';
    const encoded = serializeShareState(state);
    expect(parseShareState(encoded)?.functions[0].raw).toBe('r=cos(3*θ)');
  });

  it('round-trips 10 curves + 2 sliders and loads an old 5-row link', () => {
    const rows = (n: number, raw: (i: number) => string) =>
      Array.from({ length: n }, (_, i) => ({ raw: raw(i), color: '#00ff88', visible: true }));
    const big = makeState();
    big.functions = [...rows(10, (i) => `x+${i}`), ...rows(2, (i) => `${'ab'[i]} = 1`)];
    big.tool = { active: 'integral', integral: { fnIndex: 9, a: 0, b: 1 } };
    expect(parseShareState(serializeShareState(big))).toEqual(big);
    const old = makeState();
    old.functions = rows(5, (i) => `x+${i}`);
    expect(parseShareState(serializeShareState(old))).toEqual(old);
  });

  it('rejects invalid base64', () => {
    expect(parseShareState('not-valid-base64!!!')).toBeNull();
  });

  it('rejects valid base64 that is not JSON', () => {
    const encoded = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_');
    expect(parseShareState(encoded)).toBeNull();
  });

  it('rejects a payload missing required fields', () => {
    const encoded = serializeShareState({
      v: SHARE_STATE_VERSION,
      functions: [],
      viewport: { xMin: -10, xMax: 10, yMin: -7, yMax: 7 },
      tool: { active: null },
    });
    // Corrupt: drop viewport by re-encoding a bad object directly.
    const bad = btoa(
      JSON.stringify({ v: SHARE_STATE_VERSION, functions: [], tool: { active: null } }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(parseShareState(bad)).toBeNull();
    expect(parseShareState(encoded)).not.toBeNull();
  });

  it('ignores an unknown/future version', () => {
    const encoded = serializeShareState({ ...makeState(), v: 999 });
    expect(parseShareState(encoded)).toBeNull();
  });

  it('reads a v1 link (no derivative/tangent fields) and upgrades it to v2', () => {
    const v1 = { ...makeState(), v: 1 };
    const parsed = parseShareState(serializeShareState(v1));
    expect(parsed).toEqual({ ...makeState(), v: SHARE_STATE_VERSION });
    expect(SHARE_STATE_VERSION).toBe(2);
    expect(parsed?.tangent).toBeUndefined();
    expect(parsed?.functions[0].derivative).toBeUndefined();
  });

  it('round-trips slider bounds and drops invalid ones, keeping the link', () => {
    const state = makeState();
    state.functions.push({
      raw: 'a = 2',
      color: '#00ccff',
      visible: true,
      slider: { min: -5, max: 20, step: 0.5 },
    });
    expect(parseShareState(serializeShareState(state))).toEqual(state);
    for (const slider of [
      { min: 3, max: 1, step: 0.1 },
      { min: 0, max: 1, step: 0 },
      { min: 0, max: 1e9, step: 1 },
      { min: 0, max: 1, step: 2 },
      'x',
    ]) {
      const junk = {
        ...makeState(),
        functions: [{ raw: 'a = 1', color: '#00ff88', visible: true, slider }],
      };
      const parsed = parseShareState(serializeShareState(junk as unknown as ShareState));
      expect(parsed?.functions[0]).toEqual({ raw: 'a = 1', color: '#00ff88', visible: true });
    }
  });

  it('round-trips the v2 f′ and tangent toggles, dropping non-true values', () => {
    const state = makeState();
    state.functions[0].derivative = true;
    state.tangent = true;
    expect(parseShareState(serializeShareState(state))).toEqual(state);
    const junk = {
      ...makeState(),
      tangent: 'yes',
      functions: [{ raw: 'x', color: '#00ff88', visible: true, derivative: 1 }],
    };
    const parsed = parseShareState(serializeShareState(junk as unknown as ShareState));
    expect(parsed?.tangent).toBeUndefined();
    expect(parsed?.functions[0]).toEqual({ raw: 'x', color: '#00ff88', visible: true });
  });

  it('extracts nothing when there is no #s= fragment', () => {
    expect(extractShareFragment('#foo=bar')).toBeNull();
  });

  describe('strict validation', () => {
    const enc = (o: unknown) => serializeShareState(o as ShareState);
    const base = () => ({ ...makeState() }) as Record<string, unknown>;

    it('rejects absurd or inverted viewports', () => {
      for (const viewport of [
        { xMin: 1e16, xMax: 1e16 + 4, yMin: -1, yMax: 1 },
        { xMin: 5, xMax: -5, yMin: -1, yMax: 1 },
        { xMin: 0, xMax: 0, yMin: -1, yMax: 1 },
        { xMin: -1e300, xMax: 1e300, yMin: -1, yMax: 1 },
        { xMin: 1e8, xMax: 1e8 + 1e-3, yMin: -1, yMax: 1 },
      ]) {
        expect(parseShareState(enc({ ...base(), viewport }))).toBeNull();
      }
    });

    it('rejects more than 10 curves, more than 10 sliders and over-long raw (2MB style)', () => {
      const f = { raw: 'x', color: '#00ff88', visible: true };
      const sl = { raw: 'a = 1', color: '#00ff88', visible: true };
      expect(parseShareState(enc({ ...base(), functions: Array(11).fill(f) }))).toBeNull();
      expect(parseShareState(enc({ ...base(), functions: Array(11).fill(sl) }))).toBeNull();
      expect(parseShareState(enc({ ...base(), functions: Array(10).fill(f) }))).not.toBeNull();
      const huge = { ...f, raw: 'x'.repeat(2_000_000) };
      expect(parseShareState(enc({ ...base(), functions: [huge] }))).toBeNull();
    });

    it('falls back to the palette color for non-hex colors', () => {
      const f = { raw: 'x', color: 'url(https://evil/p.gif)', visible: true };
      const parsed = parseShareState(enc({ ...base(), functions: [f] }));
      expect(parsed?.functions[0].color).toBe('#00ff88');
    });

    it('drops an integral tool with a=1e308 but keeps the link', () => {
      const tool = { active: 'integral', integral: { fnIndex: 0, a: 1e308, b: 2 } };
      const parsed = parseShareState(enc({ ...base(), tool }));
      expect(parsed?.tool).toEqual({ active: null });
    });

    it('drops a malformed solid body instead of throwing', () => {
      const solid = {
        method: 'shell',
        curveIndices: 'nope',
        a: 5,
        b: '1',
        axisValue: '0',
        shape: 'square',
        heightRatio: '1',
      };
      const parsed = parseShareState(enc({ ...base(), tool: { active: 'solid', solid } }));
      expect(parsed?.tool).toEqual({ active: null });
    });

    it('drops tools with duplicate/out-of-range indices or bad enums', () => {
      const area = { functionIndices: [0, 0], a: 0, b: 1, overlapMode: 'all' };
      expect(
        parseShareState(enc({ ...base(), tool: { active: 'area', area } }))?.tool.active,
      ).toBeNull();
      const area2 = { functionIndices: [0, 25], a: 0, b: 1, overlapMode: 'all' };
      expect(
        parseShareState(enc({ ...base(), tool: { active: 'area', area: area2 } }))?.tool.active,
      ).toBeNull();
      const area3 = { functionIndices: [0, 1], a: 0, b: 1, overlapMode: 'x' };
      expect(
        parseShareState(enc({ ...base(), tool: { active: 'area', area: area3 } }))?.tool.active,
      ).toBeNull();
    });

    it('keeps a valid solid tool', () => {
      const solid = {
        method: 'disk-washer',
        curveIndices: [0, 1],
        a: '0',
        b: 'pi',
        axisValue: '0',
        shape: 'square',
        heightRatio: '1',
      };
      const parsed = parseShareState(enc({ ...base(), tool: { active: 'solid', solid } }));
      expect(parsed?.tool.solid).toEqual(solid);
    });
  });

  describe('infinite integral bounds', () => {
    for (const [a, b] of [
      [0, Infinity],
      [-Infinity, 1],
    ]) {
      it(`round-trips a=${a}, b=${b}`, () => {
        const state = makeState();
        state.tool.integral = { fnIndex: 0, a, b };
        const parsed = parseShareState(serializeShareState(state));
        expect(parsed?.tool.active).toBe('integral');
        expect(parsed?.tool.integral).toEqual({ fnIndex: 0, a, b });
      });
    }
  });
});
