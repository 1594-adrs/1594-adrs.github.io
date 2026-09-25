import { describe, it, expect } from 'vitest';
import { buildTerms } from './solid-formula';
import { computePieces, sliceArea } from './solid-integrand';
import { evaluate } from '../evaluator';
import { parse } from '../parser';
import type { SolidCurve, SolidSpec } from './solid.types';

function symbolicCurve(expr: string, label: string): SolidCurve {
  const ast = parse(expr);
  return {
    fn: (t: number) => evaluate(ast, { x: t, y: t }),
    ast,
    label,
    color: '#000',
  };
}

/** coefficient (or 1 if null) evaluated numerically. */
function coeffValue(coefficient: SolidCurve['ast']): number {
  return coefficient ? evaluate(coefficient, {}) : 1;
}

describe('buildTerms', () => {
  it('builds one term per piece, matching sliceArea at the piece midpoint (disk, single curve)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [symbolicCurve('x', 'f1')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    const terms = buildTerms(spec, pieces);
    const area = sliceArea(spec, pieces);

    expect(terms).toHaveLength(1);
    expect(terms[0].variable).toBe('x');
    expect(terms[0].coefficient).toEqual({ type: 'Variable', name: 'π' });

    const t = 0.5;
    const fromTerm = coeffValue(terms[0].coefficient) * evaluate(terms[0].integrand, { x: t });
    expect(fromTerm).toBeCloseTo(area(t), 10);
  });

  it('omits the r² term for a single curve (no baseline subtraction artefact)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [symbolicCurve('x', 'f1')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const [term] = buildTerms(spec, computePieces(spec));
    // (x - 0)^2 simplifies to x^2, not (x - 0)^2 - 0^2.
    expect(term.integrand).toEqual({
      type: 'BinaryOp',
      operator: '^',
      left: { type: 'Variable', name: 'x' },
      right: { type: 'NumberLiteral', value: 2 },
    });
  });

  it('builds a washer term matching sliceArea (two curves)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [symbolicCurve('x', 'f1'), symbolicCurve('x^2', 'f2')],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    const terms = buildTerms(spec, pieces);
    const area = sliceArea(spec, pieces);

    expect(terms).toHaveLength(1);
    const t = 0.5;
    const fromTerm = coeffValue(terms[0].coefficient) * evaluate(terms[0].integrand, { x: t });
    expect(fromTerm).toBeCloseTo(area(t), 10);
  });

  it('builds two terms with swapped upper/lower after a crossing (spec 17 scenario)', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [symbolicCurve('x', 'f1'), symbolicCurve('x^2', 'f2')],
      a: 0,
      b: 2,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const pieces = computePieces(spec);
    const terms = buildTerms(spec, pieces);
    const area = sliceArea(spec, pieces);

    expect(terms).toHaveLength(2);
    for (const [i, term] of terms.entries()) {
      const t = 0.5 * (pieces[i].a + pieces[i].b);
      const fromTerm = coeffValue(term.coefficient) * evaluate(term.integrand, { x: t });
      expect(fromTerm).toBeCloseTo(area(t), 8);
    }
  });

  it('builds a shell term with coefficient 2π and the correct (t-k)/(k-t) sign', () => {
    const spec: SolidSpec = {
      method: 'shell',
      variable: 'x',
      curves: [symbolicCurve('x^2', 'f1')],
      a: 0,
      b: 1,
      axis: { orientation: 'vertical', value: 2 },
    };
    const pieces = computePieces(spec);
    const [term] = buildTerms(spec, pieces);
    const area = sliceArea(spec, pieces);

    expect(term.coefficient).toEqual({
      type: 'BinaryOp',
      operator: '*',
      left: { type: 'NumberLiteral', value: 2 },
      right: { type: 'Variable', name: 'π' },
    });

    const t = 0.5;
    const fromTerm = coeffValue(term.coefficient) * evaluate(term.integrand, { x: t });
    expect(fromTerm).toBeCloseTo(area(t), 10);
    // axis (k=2) is to the right of the whole domain [0,1], so the sign
    // should be written as (k - t), not (t - k).
    expect(term.integrand).toMatchObject({ type: 'BinaryOp', operator: '*' });
  });

  it('builds cross-section terms with the shape-specific coefficient', () => {
    const base: Omit<SolidSpec, 'shape' | 'heightRatio'> = {
      method: 'cross-section',
      variable: 'x',
      curves: [symbolicCurve('sqrt(1-x^2)', 'f1'), symbolicCurve('-sqrt(1-x^2)', 'f2')],
      a: -1,
      b: 1,
    };

    const cases: Array<{ shape: SolidSpec['shape']; heightRatio?: number; coeffValue: number }> = [
      { shape: 'square', coeffValue: 1 },
      { shape: 'rectangle', heightRatio: 3, coeffValue: 3 },
      { shape: 'equilateral-triangle', coeffValue: Math.sqrt(3) / 4 },
      { shape: 'right-isosceles-leg', coeffValue: 0.5 },
      { shape: 'right-isosceles-hypotenuse', coeffValue: 0.25 },
      { shape: 'semicircle', coeffValue: Math.PI / 8 },
    ];

    for (const c of cases) {
      const spec: SolidSpec = { ...base, shape: c.shape, heightRatio: c.heightRatio };
      const pieces = computePieces(spec);
      const [term] = buildTerms(spec, pieces);
      const area = sliceArea(spec, pieces);

      if (c.coeffValue === 1) {
        expect(term.coefficient).toBeNull();
      }
      const t = 0.3;
      const fromTerm = coeffValue(term.coefficient) * evaluate(term.integrand, { x: t });
      expect(fromTerm).toBeCloseTo(area(t), 8);
      expect(coeffValue(term.coefficient)).toBeCloseTo(c.coeffValue, 10);
    }
  });

  it('falls back to a function-call-like node when a curve has no AST', () => {
    const spec: SolidSpec = {
      method: 'disk-washer',
      variable: 'x',
      curves: [{ fn: (t) => t, ast: null, label: 'p₁', color: '#000' }],
      a: 0,
      b: 1,
      axis: { orientation: 'horizontal', value: 0 },
    };
    const [term] = buildTerms(spec, computePieces(spec));
    expect(term.integrand).toEqual({
      type: 'BinaryOp',
      operator: '^',
      left: {
        type: 'FunctionCall',
        name: 'p₁',
        arg: { type: 'Variable', name: 'x' },
      },
      right: { type: 'NumberLiteral', value: 2 },
    });
  });
});
