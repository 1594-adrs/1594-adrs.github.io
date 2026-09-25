import { describe, it, expect } from 'vitest';
import { computeSolid } from './index';
import { evaluate } from '../evaluator';
import { parse } from '../parser';
import type { SolidCurve, SolidSpec } from './solid.types';

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
}

function curveFromExpr(expr: string, label = 'f1'): SolidCurve {
  const ast = parse(expr);
  return {
    fn: (t: number) => evaluate(ast, { x: t, y: t }),
    ast,
    label,
    color: '#000',
  };
}

describe('computeSolid', () => {
  it('1: disk y=x on [0,1] about y=0 -> π/3', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.volume).not.toBeNull();
    expect(relErr(r.volume!, Math.PI / 3)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('π/3');
    expect(r.issues).toEqual([]);
  });

  it('2: disk y=sqrt(x) on [0,4] about y=0 -> 8π', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('sqrt(x)')],
      a: 0,
      b: 4,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, 8 * Math.PI)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('8π');
  });

  it('3: disk y=sqrt(1-x^2) on [-1,1] about y=0 -> 4π/3', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('sqrt(1-x^2)')],
      a: -1,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (4 * Math.PI) / 3)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('4π/3');
  });

  it('4: washer y=x & y=x^2 on [0,1] about y=0 -> 2π/15', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x', 'f1'), curveFromExpr('x^2', 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (2 * Math.PI) / 15)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('2π/15');
  });

  it('5: washer y=x & y=x^2 on [0,1] about y=-1 -> 7π/15', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x', 'f1'), curveFromExpr('x^2', 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: -1 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (7 * Math.PI) / 15)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('7π/15');
  });

  it('6: disk, variable y, curve x=y^2 on [0,1] about vertical x=0 -> π/5', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'y',
      curves: [curveFromExpr('y^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, Math.PI / 5)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('π/5');
  });

  it('7: shell y=x^2 on [0,1] about x=0 -> π/2', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, Math.PI / 2)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('π/2');
  });

  it('8: shell y=x^2 on [0,1] about x=2 -> 5π/6', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (5 * Math.PI) / 6)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('5π/6');
  });

  it('9: disk y=ln(x) on [0,1] about y=0 -> 2π (endpoint singularity)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('ln(x)')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.volume).not.toBeNull();
    expect(relErr(r.volume!, 2 * Math.PI)).toBeLessThanOrEqual(1e-6);
    expect(r.exact).toBe('2π');
  });

  it('10: disk y=x^(1/3) on [-1,1] about y=0 -> 6π/5 (real cube roots)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x^(1/3)')],
      a: -1,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.volume).not.toBeNull();
    expect(relErr(r.volume!, (6 * Math.PI) / 5)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('6π/5');
  });

  it('11: square cross-sections between sqrt(1-x^2) and -sqrt(1-x^2) on [-1,1] -> 16/3', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('sqrt(1-x^2)', 'f1'), curveFromExpr('-sqrt(1-x^2)', 'f2')],
      a: -1,
      b: 1,
      shape: 'square',
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, 16 / 3)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('16/3');
  });

  it('12: semicircle cross-sections, same base -> 2π/3', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('sqrt(1-x^2)', 'f1'), curveFromExpr('-sqrt(1-x^2)', 'f2')],
      a: -1,
      b: 1,
      shape: 'semicircle',
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (2 * Math.PI) / 3)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('2π/3');
  });

  it('13: equilateral-triangle cross-sections, same base -> 4√3/3', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('sqrt(1-x^2)', 'f1'), curveFromExpr('-sqrt(1-x^2)', 'f2')],
      a: -1,
      b: 1,
      shape: 'equilateral-triangle',
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (4 * Math.sqrt(3)) / 3)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('4√3/3');
  });

  it('14: right-isosceles-leg cross-sections between y=x and y=x^2 on [0,1] -> 1/60', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('x', 'f1'), curveFromExpr('x^2', 'f2')],
      a: 0,
      b: 1,
      shape: 'right-isosceles-leg',
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, 1 / 60)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('1/60');
  });

  it('15: rectangle cross-sections (heightRatio 2), y=sqrt(x) on [0,4] -> 16', () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('sqrt(x)')],
      a: 0,
      b: 4,
      shape: 'rectangle',
      heightRatio: 2,
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, 16)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('16');
  });

  // Hand-checked: x = y^2 on [0,1], shell about the horizontal line y = 2 (a
  // horizontal axis matches shell + variable 'y' per the contract). Radius
  // is |y-2| = 2-y throughout [0,1]; height is y^2 - 0.
  // V = 2π ∫0^1 (2-y) y^2 dy = 2π [2y^3/3 - y^4/4] = 2π(2/3 - 1/4) = 5π/6.
  it('16: shell, variable y, curve x=y^2 on [0,1] about horizontal y=2 -> 5π/6', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'y',
      curves: [curveFromExpr('y^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 2 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, (5 * Math.PI) / 6)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('5π/6');
  });

  it('17: washer y=x & y=x^2 on [0,2] about y=0, split at the crossing -> 4π', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x', 'f1'), curveFromExpr('x^2', 'f2')],
      a: 0,
      b: 2,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.pieces).toHaveLength(2);
    expect(relErr(r.volume!, 4 * Math.PI)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('4π');
  });

  it('18: disk y=1/x on [-1,1] about y=0 -> null volume, divergent issue', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('1/x')],
      a: -1,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.volume).toBeNull();
    expect(r.exact).toBeNull();
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].code).toBe('divergent');
    expect(r.issues[0].severity).toBe('error');
  });

  it('19: disk y=sqrt(x) on [-1,1] about y=0 -> null volume, undefined-domain issue', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('sqrt(x)')],
      a: -1,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.volume).toBeNull();
    expect(r.exact).toBeNull();
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].code).toBe('undefined-domain');
    expect(r.issues[0].severity).toBe('error');
  });

  it('20: envelope x, x^2, x^3 on [0,1] about y=0 -> 4pi/21 (upper x, lower x^3)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x', 'f1'), curveFromExpr('x^2', 'f2'), curveFromExpr('x^3', 'f3')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.pieces).toHaveLength(1);
    expect(r.pieces[0].upperIndex).toBe(0);
    expect(r.pieces[0].lowerIndex).toBe(2);
    expect(relErr(r.volume!, (4 * Math.PI) / 21)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('4π/21');
  });

  it('21: shell y=x^2 on [0,1] about x=0.5 (axis inside domain) splits into 2 pieces, same volume', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0.5 },
    };
    const r = computeSolid(spec);
    expect(r.pieces).toHaveLength(2);
    // Hand-checked via Simpson's rule (1e6 panels): 2*pi*Integral(|x-0.5|*x^2, 0, 1) ~= 0.5890486225.
    expect(relErr(r.volume!, 0.5890486225480873)).toBeLessThanOrEqual(1e-6);
  });

  it("22: computeSolid never throws with 6 curves (too-many-curves is validateSolidSpec's job)", () => {
    const spec: SolidSpec = {
      method: 'cross-section',
      variable: 'x',
      curves: [
        curveFromExpr('x', 'f1'),
        curveFromExpr('x+1', 'f2'),
        curveFromExpr('x+2', 'f3'),
        curveFromExpr('x+3', 'f4'),
        curveFromExpr('x+4', 'f5'),
        curveFromExpr('x+5', 'f6'),
      ],
      a: 0,
      b: 1,
      shape: 'square',
    };
    // computeSolid doesn't itself gate on curve count (that's validateSolidSpec's job), but it
    // must still never throw with 6 curves.
    expect(() => computeSolid(spec)).not.toThrow();
  });

  it('never throws on a structurally odd spec (missing axis)', () => {
    const spec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('x')],
      a: 0,
      b: 1,
    } as SolidSpec;
    expect(() => computeSolid(spec)).not.toThrow();
  });

  it('runs the 19 hand-checked cases quickly', () => {
    const specs: SolidSpec[] = [
      {
        method: 'disk-washer',
        variable: 'x',
        curves: [curveFromExpr('x')],
        a: 0,
        b: 1,
        axis: { orientation: 'horizontal', value: 0 },
      },
      {
        method: 'shell',
        variable: 'x',
        curves: [curveFromExpr('x^2')],
        a: 0,
        b: 1,
        axis: { orientation: 'vertical', value: 2 },
      },
      {
        method: 'cross-section',
        variable: 'x',
        curves: [curveFromExpr('sqrt(1-x^2)', 'f1'), curveFromExpr('-sqrt(1-x^2)', 'f2')],
        a: -1,
        b: 1,
        shape: 'semicircle',
      },
    ];
    const start = performance.now();
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      for (const spec of specs) computeSolid(spec);
    }
    const elapsedMs = performance.now() - start;
    const perCall = elapsedMs / (iterations * specs.length);
    // eslint-disable-next-line no-console
    console.log(
      `computeSolid: ${iterations * specs.length} calls took ${elapsedMs.toFixed(2)}ms (${perCall.toFixed(3)}ms/call)`,
    );
    expect(elapsedMs).toBeLessThan(5000);
  });
});
