import { describe, it, expect } from 'vitest';
import * as engineUtils from './numeric-utils';
import * as canvasUtils from '../canvas/utils';

describe('numeric-utils (H22)', () => {
  it('canvas/utils re-exports the engine implementations (no duplicate copies)', () => {
    expect(canvasUtils.tryEval).toBe(engineUtils.tryEval);
    expect(canvasUtils.findAxisCrossings).toBe(engineUtils.findAxisCrossings);
  });

  it('findAxisCrossings: identically-k function has no discrete crossings', () => {
    expect(engineUtils.findAxisCrossings(() => 0, -5, 5, 0)).toEqual([]);
    expect(engineUtils.findAxisCrossings(() => 2, -5, 5, 2)).toEqual([]);
  });

  it('findAxisCrossings: roots of steep curves on wide domains (no absolute 0.05 guard)', () => {
    const r = engineUtils.findAxisCrossings((x) => x * x - 2, -100, 100, 0);
    expect(r.length).toBe(2);
    expect(r[1]).toBeCloseTo(Math.SQRT2, 9);
    const e = engineUtils.findAxisCrossings(Math.exp, -10, 10, 1000);
    expect(e.length).toBe(1);
    expect(e[0]).toBeCloseTo(Math.log(1000), 9);
  });

  it('findAxisCrossings: pole jumps are not roots, tangencies are', () => {
    expect(engineUtils.findAxisCrossings(Math.tan, 1, 2, 0)).toEqual([]);
    const t = engineUtils.findAxisCrossings((x) => x * x, -1, 1, 0);
    expect(t.length).toBe(1);
    expect(Math.abs(t[0])).toBeLessThan(1e-4);
  });

  it('bisectSignChange: converges to the root, null when not a bracket or not finite', () => {
    expect(engineUtils.bisectSignChange((x) => x - 0.3, 0, 1)).toBeCloseTo(0.3, 12);
    expect(engineUtils.bisectSignChange((x) => x * x + 1, 0, 1)).toBeNull();
    expect(engineUtils.bisectSignChange((x) => (x > 0.5 ? NaN : x - 0.2), 0, 1)).toBeNull();
  });
});
