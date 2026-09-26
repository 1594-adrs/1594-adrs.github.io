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

  it('extracts nothing when there is no #s= fragment', () => {
    expect(extractShareFragment('#foo=bar')).toBeNull();
  });
});
