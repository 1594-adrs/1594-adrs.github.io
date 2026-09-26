import type { ExpressionNode } from '../parser';
import type { CrossSectionShape, SolidIntegralTerm, SolidPiece, SolidSpec } from './solid.types';

/**
 * Builds the closed-form ExpressionNode terms behind a SolidResult, one per
 * piece, composing AST nodes programmatically from the curves' own `ast`
 * (never by string-parsing). Trivial algebraic simplifications are applied
 * so the rendered formula doesn't show "− 0", "+ 0", a lone "(x − 0)", or a
 * coefficient of 1.
 */

function numberNode(value: number): ExpressionNode {
  return { type: 'NumberLiteral', value };
}

function piNode(): ExpressionNode {
  return { type: 'Variable', name: 'π' };
}

function isZero(node: ExpressionNode): boolean {
  return node.type === 'NumberLiteral' && node.value === 0;
}

function isOne(node: ExpressionNode): boolean {
  return node.type === 'NumberLiteral' && node.value === 1;
}

function sub(left: ExpressionNode, right: ExpressionNode): ExpressionNode {
  if (isZero(right)) return left;
  if (isZero(left)) return { type: 'UnaryOp', operator: '-', operand: right };
  // left − (−x) is left + x, not a literal "− −x" double negative.
  if (right.type === 'UnaryOp' && right.operator === '-') {
    return { type: 'BinaryOp', operator: '+', left, right: right.operand };
  }
  return { type: 'BinaryOp', operator: '-', left, right };
}

function mul(left: ExpressionNode, right: ExpressionNode): ExpressionNode {
  if (isOne(left)) return right;
  if (isOne(right)) return left;
  if (isZero(left) || isZero(right)) return numberNode(0);
  return { type: 'BinaryOp', operator: '*', left, right };
}

function div(left: ExpressionNode, right: ExpressionNode): ExpressionNode {
  if (isOne(right)) return left;
  return { type: 'BinaryOp', operator: '/', left, right };
}

function squared(node: ExpressionNode): ExpressionNode {
  return { type: 'BinaryOp', operator: '^', left: node, right: numberNode(2) };
}

/** AST for a curve's boundary value; `null` (baseline) becomes a literal. */
function curveNode(spec: SolidSpec, index: number | null, baseline: number): ExpressionNode {
  if (index === null) return numberNode(baseline);
  const curve = spec.curves[index];
  if (curve.ast) return curve.ast;
  // No symbolic AST (parametric/polar samples): fall back to a
  // function-call-like node applying the curve's display label to the
  // integration variable, e.g. 'f₁(x)'.
  return {
    type: 'FunctionCall',
    name: curve.label,
    arg: { type: 'Variable', name: spec.variable },
  };
}

function variableNode(spec: SolidSpec): ExpressionNode {
  return { type: 'Variable', name: spec.variable };
}

function baselineFor(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

function safeEval(fn: (t: number) => number, t: number): number {
  try {
    return fn(t);
  } catch {
    return NaN;
  }
}

function buildDiskWasherTerm(spec: SolidSpec, piece: SolidPiece): SolidIntegralTerm {
  const k = spec.axis?.value ?? 0;
  const kNode = numberNode(k);
  const mid = 0.5 * (piece.a + piece.b);

  const upperVal = piece.upperIndex === null ? k : safeEval(spec.curves[piece.upperIndex].fn, mid);
  const lowerVal = piece.lowerIndex === null ? k : safeEval(spec.curves[piece.lowerIndex].fn, mid);
  const upperDist = Math.abs(upperVal - k);
  const lowerDist = Math.abs(lowerVal - k);
  const farIsUpper =
    Number.isFinite(upperDist) && Number.isFinite(lowerDist) ? upperDist >= lowerDist : true;

  const farIndex = farIsUpper ? piece.upperIndex : piece.lowerIndex;
  const nearIndex = farIsUpper ? piece.lowerIndex : piece.upperIndex;

  const farTerm = squared(sub(curveNode(spec, farIndex, k), kNode));
  // The baseline (null) is exactly the axis value k, so (baseline − k) is
  // structurally zero, not merely numerically close - omit the r² term
  // entirely rather than relying on sub()'s literal-zero detection.
  const integrand =
    nearIndex === null ? farTerm : sub(farTerm, squared(sub(curveNode(spec, nearIndex, k), kNode)));

  return {
    coefficient: piNode(),
    a: piece.a,
    b: piece.b,
    integrand,
    variable: spec.variable,
  };
}

function buildShellTerm(spec: SolidSpec, piece: SolidPiece): SolidIntegralTerm {
  const k = spec.axis?.value ?? 0;
  const mid = 0.5 * (piece.a + piece.b);
  const kNode = numberNode(k);
  const tNode = variableNode(spec);
  const tMinusK = mid >= k ? sub(tNode, kNode) : sub(kNode, tNode);

  const upperNode = curveNode(spec, piece.upperIndex, 0);
  const lowerNode = curveNode(spec, piece.lowerIndex, 0);
  const width = sub(upperNode, lowerNode);

  return {
    coefficient: mul(numberNode(2), piNode()),
    a: piece.a,
    b: piece.b,
    integrand: mul(tMinusK, width),
    variable: spec.variable,
  };
}

function crossSectionCoefficient(
  shape: CrossSectionShape | undefined,
  heightRatio: number | undefined,
): ExpressionNode | null {
  switch (shape) {
    case 'rectangle': {
      const h = heightRatio ?? 1;
      return h === 1 ? null : numberNode(h);
    }
    case 'equilateral-triangle':
      return div({ type: 'FunctionCall', name: 'sqrt', arg: numberNode(3) }, numberNode(4));
    case 'right-isosceles-leg':
      return div(numberNode(1), numberNode(2));
    case 'right-isosceles-hypotenuse':
      return div(numberNode(1), numberNode(4));
    case 'semicircle':
      return div(piNode(), numberNode(8));
    case 'square':
    default:
      return null;
  }
}

function buildCrossSectionTerm(spec: SolidSpec, piece: SolidPiece): SolidIntegralTerm {
  const upperNode = curveNode(spec, piece.upperIndex, 0);
  const lowerNode = curveNode(spec, piece.lowerIndex, 0);
  const width = sub(upperNode, lowerNode);

  return {
    coefficient: crossSectionCoefficient(spec.shape, spec.heightRatio),
    a: piece.a,
    b: piece.b,
    integrand: squared(width),
    variable: spec.variable,
  };
}

/** One SolidIntegralTerm per piece; the volume is the sum of their integrals. */
export function buildTerms(spec: SolidSpec, pieces: SolidPiece[]): SolidIntegralTerm[] {
  return pieces.map((piece) => {
    switch (spec.method) {
      case 'disk-washer':
        return buildDiskWasherTerm(spec, piece);
      case 'shell':
        return buildShellTerm(spec, piece);
      case 'cross-section':
      default:
        return buildCrossSectionTerm(spec, piece);
    }
  });
}
