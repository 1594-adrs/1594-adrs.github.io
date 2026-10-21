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

  it('20b: envelope 1/x & -sqrt(1-x^2) on [-1,1] about y=0 -> null volume, divergent (pole at x=0)', () => {
    // No real crossing (1/x < -sqrt(1-x^2) throughout (-1,0), and 1/x > -sqrt(1-x^2)
    // throughout (0,1)), so this is a single piece whose envelope midpoint is exactly the
    // pole of 1/x - a regression case for silently excluding a curve from the envelope
    // (and reporting a bogus volume of 0) when the probed sample coincides with its pole.
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [curveFromExpr('1/x', 'f1'), curveFromExpr('-sqrt(1-x^2)', 'f2')],
      a: -1,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.pieces.length).toBeGreaterThan(0);
    expect(r.pieces.some((p) => p.upperIndex === 0 || p.lowerIndex === 0)).toBe(true);
    expect(r.volume).toBeNull();
    expect(r.exact).toBeNull();
    expect(r.issues.some((i) => i.code === 'divergent')).toBe(true);
  });

  it('formats a near-zero "bad point" as 0, not e.g. -1.862645149230957e-9', () => {
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
    const divergent = r.issues.find((i) => i.code === 'divergent');
    expect(divergent).toBeDefined();
    expect(divergent!.message).not.toMatch(/e[+-]/);
    expect(divergent!.message).toContain('x = 0');
  });

  it('21: shell y=x^2 on [0,1] about x=0.5 counts the overlapping sides once: 17π/96', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0.5 },
    };
    const r = computeSolid(spec);
    // The right side contains the left one at every radius, so the union is the right side alone
    // (the plain shell sum 2*pi*Integral(|x-0.5|*x^2) = 0.58905 would double count).
    expect(relErr(r.volume!, (17 * Math.PI) / 96)).toBeLessThanOrEqual(1e-9);
    expect(r.issues).toEqual([]);
    expect(r.pieces.map((p) => [p.a, p.b])).toEqual([[0.5, 1]]);
  });

  it('21c: shell 3+2x-x^2 on [-1,3] about its own symmetry axis x=1 is 8π, one term on [1,3]', () => {
    const r = computeSolid({
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('3+2x-x^2')],
      a: -1,
      b: 3,
      axis: { orientation: 'vertical', value: 1 },
    });
    expect(relErr(r.volume!, 8 * Math.PI)).toBeLessThanOrEqual(1e-9);
    expect(r.exact).toBe('8π');
    expect(r.terms).toHaveLength(1);
    expect([r.terms[0].a, r.terms[0].b]).toEqual([1, 3]);
  });

  it('21d: shell y=x^2 on [0,1] about x=0.25 keeps the right side plus its tail: 171π/512', () => {
    const r = computeSolid({
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x^2')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0.25 },
    });
    expect(relErr(r.volume!, (171 * Math.PI) / 512)).toBeLessThanOrEqual(1e-9);
    expect(r.pieces.map((p) => [p.a, p.b])).toEqual([[0.25, 1]]);
  });

  it('21e: shell 2+sin(3x) on [-1.5,1.5] about x=0 switches sides at r=π/3: 2π∫ r(2+|sin 3r|) dr', () => {
    const r = computeSolid({
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('2+sin(3x)')],
      a: -1.5,
      b: 1.5,
      axis: { orientation: 'vertical', value: 0 },
    });
    const n = 200000;
    let expected = 0;
    for (let i = 0; i < n; i++) {
      const t = (1.5 * (i + 0.5)) / n;
      expected += t * (2 + Math.abs(Math.sin(3 * t)));
    }
    expected *= (2 * Math.PI * 1.5) / n;
    expect(relErr(r.volume!, expected)).toBeLessThanOrEqual(1e-8);
    expect(r.pieces.map((p) => [p.a, p.b])).toEqual(
      [
        [-1.5, -Math.PI / 3],
        [0, Math.PI / 3],
      ].map(([a, b]) => [expect.closeTo(a, 9), expect.closeTo(b, 9)]),
    );
  });

  it('21f: shell between x+1 and x+2 on [-1,1] about x=0 (sides partly overlap) is blocked', () => {
    const r = computeSolid({
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x+1', 'f1'), curveFromExpr('x+2', 'f2')],
      a: -1,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    });
    expect(r.volume).toBeNull();
    expect(r.issues).toEqual([
      expect.objectContaining({ code: 'axis-inside-region', severity: 'error', field: 'axis' }),
    ]);
  });

  it('21b: shell y=x on [-1,1] about x=0 (sides never overlap) is still computed: 4π/3', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x')],
      a: -1,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    };
    const r = computeSolid(spec);
    expect(r.volume).not.toBeNull();
    expect(relErr(r.volume!, (4 * Math.PI) / 3)).toBeLessThanOrEqual(1e-7);
    expect(r.pieces).toHaveLength(2);
  });

  it('H14: shell y=1 on [-1,1] about x=0 is the union cylinder π, not 2π', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('1')],
      a: -1,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    };
    const r = computeSolid(spec);
    expect(relErr(r.volume!, Math.PI)).toBeLessThanOrEqual(1e-9);
    // The disk method gives the same union for the same region: π.
    const disk = computeSolid({
      method: 'disk-washer',
      variable: 'y',
      curves: [curveFromExpr('1')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 0 },
    });
    expect(relErr(disk.volume!, Math.PI)).toBeLessThanOrEqual(1e-9);
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

describe('computeSolid wave-1 regressions', () => {
  it('H1: shell y=x^2-1 on [-2,2] about x=-3 -> 24π (75.398), not the signed -25.13', () => {
    const r = computeSolid({
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('x^2-1')],
      a: -2,
      b: 2,
      axis: { orientation: 'vertical', value: -3 },
    });
    expect(r.volume).not.toBeNull();
    expect(relErr(r.volume!, 24 * Math.PI)).toBeLessThanOrEqual(1e-7);
    expect(r.exact).toBe('24π');
    // Split where the curve crosses the baseline y = 0, so every piece has one sign.
    expect(r.pieces.map((p) => [p.a, p.b])).toEqual([
      [-2, -1],
      [-1, 1],
      [1, 2],
    ]);
    for (const t of r.terms) expect(t.integrand).toBeDefined();
  });

  it('H1: shell y=sin(x) on [0,2π] about x=-1 -> 2π(4π+4) (104.09), not -39.48', () => {
    const r = computeSolid({
      method: 'shell',
      variable: 'x',
      curves: [curveFromExpr('sin(x)')],
      a: 0,
      b: 2 * Math.PI,
      axis: { orientation: 'vertical', value: -1 },
    });
    expect(r.volume).not.toBeNull();
    expect(relErr(r.volume!, 2 * Math.PI * (4 * Math.PI + 4))).toBeLessThanOrEqual(1e-7);
  });

  it('H1: cross-section (square) over y=x^2-1 on [-2,2] is sign independent', () => {
    const r = computeSolid({
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('x^2-1')],
      a: -2,
      b: 2,
      shape: 'square',
    });
    // ∫(x^2-1)^2 = 2*(32/5 - 16/3 + 2) = 2*(96-80+30)/15 = 92/15
    expect(relErr(r.volume!, 92 / 15)).toBeLessThanOrEqual(1e-9);
  });

  it('H6: an unconvergeable integrand keeps the volume but warns and drops the exact form', () => {
    const r = computeSolid({
      method: 'cross-section',
      variable: 'x',
      curves: [curveFromExpr('sin(3000*x)')],
      a: 0,
      b: 10,
      shape: 'square',
    });
    // True volume is 5; the budget only gets within ~0.2, and says so.
    expect(r.volume).not.toBeNull();
    expect(Math.abs(r.volume! - 5)).toBeLessThan(0.5);
    expect(r.exact).toBeNull();
    expect(r.issues).toEqual([
      expect.objectContaining({ code: 'inaccurate', severity: 'warning' }),
    ]);
  });
});
