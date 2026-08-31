import type { ExpressionNode } from './parser';
import type { ConicType } from '../models/calculator.models';

export interface ConicInfo {
  type: ConicType;
  center?: { x: number; y: number };
  radius?: number;
  a?: number;
  b?: number;
  c?: number;
  isVertical?: boolean;
  foci?: Array<{ x: number; y: number }>;
  eccentricity?: number;
  vertices?: Array<{ x: number; y: number }>;
  asymptotes?: string[];
  directrix?: string;
  equation: string;
}

interface Coefficients {
  x2: number;
  y2: number;
  xy: number;
  x: number;
  y: number;
  constant: number;
}

function getCoefficients(ast: ExpressionNode): Coefficients | null {
  if (ast.type !== 'BinaryOp' || ast.operator !== '=') return null;
  const diff = subtractASTs(ast.left, ast.right);
  return extractCoeffs(diff);
}

function subtractASTs(a: ExpressionNode, b: ExpressionNode): ExpressionNode {
  return { type: 'BinaryOp', operator: '-', left: a, right: b };
}

function extractCoeffs(ast: ExpressionNode): Coefficients {
  const coeffs: Coefficients = { x2: 0, y2: 0, xy: 0, x: 0, y: 0, constant: 0 };
  collectTerms(ast, coeffs, 1);
  return coeffs;
}

function collectTerms(
  node: ExpressionNode,
  coeffs: Coefficients,
  sign: number,
): void {
  if (node.type === 'BinaryOp') {
    if (node.operator === '+') {
      collectTerms(node.left, coeffs, sign);
      collectTerms(node.right, coeffs, sign);
      return;
    }
    if (node.operator === '-') {
      collectTerms(node.left, coeffs, sign);
      collectTerms(node.right, coeffs, -sign);
      return;
    }
  }

  if (node.type === 'NumberLiteral') {
    coeffs.constant += sign * node.value;
    return;
  }

  if (node.type === 'Variable') {
    if (node.name === 'x') coeffs.x += sign;
    else if (node.name === 'y') coeffs.y += sign;
    else if (node.name === 'pi' || node.name === 'π' || node.name === 'e') {
      coeffs.constant += sign;
    }
    return;
  }

  if (node.type === 'UnaryOp' && node.operator === '-') {
    collectTerms(node.operand, coeffs, -sign);
    return;
  }

  if (node.type === 'BinaryOp' && node.operator === '*') {
    const nc = analyzeProduct(node);
    if (nc) {
      coeffs.x2 += sign * nc.x2;
      coeffs.y2 += sign * nc.y2;
      coeffs.xy += sign * nc.xy;
      coeffs.x += sign * nc.x;
      coeffs.y += sign * nc.y;
      coeffs.constant += sign * nc.constant;
      return;
    }
  }

  if (node.type === 'BinaryOp' && node.operator === '/') {
    const nc = analyzeQuotient(node);
    if (nc) {
      coeffs.x2 += sign * nc.x2;
      coeffs.y2 += sign * nc.y2;
      coeffs.xy += sign * nc.xy;
      coeffs.x += sign * nc.x;
      coeffs.y += sign * nc.y;
      coeffs.constant += sign * nc.constant;
      return;
    }
  }

  if (node.type === 'BinaryOp' && node.operator === '^') {
    const nc = analyzePower(node);
    if (nc) {
      coeffs.x2 += sign * nc.x2;
      coeffs.y2 += sign * nc.y2;
      coeffs.x += sign * nc.x;
      coeffs.y += sign * nc.y;
      coeffs.constant += sign * nc.constant;
      return;
    }
  }
}

function analyzeProduct(node: ExpressionNode): Coefficients | null {
  if (node.type !== 'BinaryOp' || node.operator !== '*') return null;
  const l = node.left;
  const r = node.right;

  if (l.type === 'Variable' && l.name === 'x' && r.type === 'Variable' && r.name === 'x') {
    return { x2: 1, y2: 0, xy: 0, x: 0, y: 0, constant: 0 };
  }
  if (l.type === 'Variable' && l.name === 'y' && r.type === 'Variable' && r.name === 'y') {
    return { x2: 0, y2: 1, xy: 0, x: 0, y: 0, constant: 0 };
  }
  if (l.type === 'Variable' && r.type === 'Variable' && l.name !== r.name) {
    return { x2: 0, y2: 0, xy: 1, x: 0, y: 0, constant: 0 };
  }

  if (l.type === 'NumberLiteral') {
    const inner = extractCoeffs(r);
    return {
      x2: l.value * inner.x2, y2: l.value * inner.y2, xy: l.value * inner.xy,
      x: l.value * inner.x, y: l.value * inner.y, constant: l.value * inner.constant,
    };
  }
  if (r.type === 'NumberLiteral') {
    const inner = extractCoeffs(l);
    return {
      x2: r.value * inner.x2, y2: r.value * inner.y2, xy: r.value * inner.xy,
      x: r.value * inner.x, y: r.value * inner.y, constant: r.value * inner.constant,
    };
  }

  return null;
}

function analyzeQuotient(node: ExpressionNode): Coefficients | null {
  if (node.type !== 'BinaryOp' || node.operator !== '/') return null;

  let divisor: number | null = null;
  if (node.right.type === 'NumberLiteral') {
    divisor = node.right.value;
  } else {
    divisor = evaluateConstantExpr(node.right);
  }

  if (divisor === null || divisor === 0) return null;
  const factor = 1 / divisor;
  const inner = extractCoeffs(node.left);
  return {
    x2: factor * inner.x2, y2: factor * inner.y2, xy: factor * inner.xy,
    x: factor * inner.x, y: factor * inner.y, constant: factor * inner.constant,
  };
}

function evaluateConstantExpr(node: ExpressionNode): number | null {
  if (node.type === 'NumberLiteral') return node.value;
  if (node.type === 'UnaryOp' && node.operator === '-') {
    const v = evaluateConstantExpr(node.operand);
    return v !== null ? -v : null;
  }
  if (node.type === 'BinaryOp') {
    const l = evaluateConstantExpr(node.left);
    const r = evaluateConstantExpr(node.right);
    if (l === null || r === null) return null;
    switch (node.operator) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return r !== 0 ? l / r : null;
      case '^': return Math.pow(l, r);
      default: return null;
    }
  }
  return null;
}

function analyzePower(node: ExpressionNode): Coefficients | null {
  if (node.type !== 'BinaryOp' || node.operator !== '^') return null;
  if (node.right.type !== 'NumberLiteral') return null;
  if (node.right.value !== 2) return null;

  if (node.left.type === 'NumberLiteral') {
    const val = node.left.value * node.left.value;
    return { x2: 0, y2: 0, xy: 0, x: 0, y: 0, constant: val };
  }

  if (node.left.type === 'UnaryOp' && node.left.operator === '-' &&
      node.left.operand.type === 'NumberLiteral') {
    const val = node.left.operand.value * node.left.operand.value;
    return { x2: 0, y2: 0, xy: 0, x: 0, y: 0, constant: val };
  }

  if (node.left.type !== 'Variable') return null;

  if (node.left.name === 'x') {
    return { x2: 1, y2: 0, xy: 0, x: 0, y: 0, constant: 0 };
  }
  if (node.left.name === 'y') {
    return { x2: 0, y2: 1, xy: 0, x: 0, y: 0, constant: 0 };
  }
  return null;
}

export function detectConic(ast: ExpressionNode): ConicInfo | null {
  const raw = getCoefficients(ast);
  if (!raw) return null;

  if (Math.abs(raw.xy) > 1e-10) return null;

  let { x2, y2, x, y, constant } = raw;

  if (x2 < 0) {
    x2 = -x2; y2 = -y2; x = -x; y = -y; constant = -constant;
  }

  if (Math.abs(x2) < 1e-10 && Math.abs(y2) < 1e-10) {
    return null;
  }

  if (Math.abs(x2 - y2) < 1e-10 && x2 > 1e-10) {
    const cx = -x / (2 * x2) || 0;
    const cy = -y / (2 * y2) || 0;
    const rSq = cx * cx + cy * cy - constant / x2;
    if (rSq < -1e-10) return null;
    const r = Math.sqrt(Math.max(0, rSq));
    return {
      type: 'circle',
      center: { x: cx, y: cy },
      radius: r,
      foci: [{ x: cx, y: cy }],
      eccentricity: 0,
      equation: formatCircle(cx, cy, r),
    };
  }

  if (x2 > 1e-10 && y2 > 1e-10 && Math.abs(x2 - y2) > 1e-10) {
    const cx = -x / (2 * x2) || 0;
    const cy = -y / (2 * y2) || 0;
    const K = (x * x) / (4 * x2) + (y * y) / (4 * y2) - constant;
    const aSq = K / x2;
    const bSq = K / y2;

    if (aSq < -1e-10 || bSq < -1e-10) return null;

    const aVal = Math.sqrt(Math.max(0, aSq));
    const bVal = Math.sqrt(Math.max(0, bSq));
    const a = Math.max(aVal, bVal);
    const b = Math.min(aVal, bVal);
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    const ecc = a > 0 ? c / a : 0;

    const foci =
      aVal >= bVal
        ? [{ x: cx + c, y: cy }, { x: cx - c, y: cy }]
        : [{ x: cx, y: cy + c }, { x: cx, y: cy - c }];

    return {
      type: 'ellipse',
      center: { x: cx, y: cy },
      a, b, c,
      isVertical: bVal > aVal,
      foci,
      eccentricity: ecc,
      equation: formatEllipse(cx, cy, aVal, bVal),
    };
  }

  if (x2 > 1e-10 && y2 < -1e-10) {
    const cx = -x / (2 * x2) || 0;
    const cy = y !== 0 ? -y / (2 * y2) : 0;
    const R = (x * x) / (4 * x2) + (y * y) / (4 * y2) - constant;

    let a: number;
    let b: number;

    if (R > 1e-10) {
      const aSq = R / x2;
      const bSq = -R / y2;
      if (aSq < -1e-10 || bSq < -1e-10) return null;
      a = Math.sqrt(Math.max(0, aSq));
      b = Math.sqrt(Math.max(0, bSq));
    } else if (R < -1e-10) {
      const aSq = R / y2;
      const bSq = -(R / x2);
      if (aSq < -1e-10 || bSq < -1e-10) return null;
      a = Math.sqrt(Math.max(0, aSq));
      b = Math.sqrt(Math.max(0, bSq));
    } else {
      return null;
    }

    const c = Math.sqrt(a * a + b * b);
    const ecc = a > 0 ? c / a : 0;
    const isVertical = R < 0;

    if (isVertical) {
      return {
        type: 'hyperbola',
        center: { x: cx, y: cy },
        a, b, c,
        isVertical: true,
        foci: [{ x: cx, y: cy + c }, { x: cx, y: cy - c }],
        eccentricity: ecc,
        asymptotes: [
          `y = ${(a / b).toFixed(4)}(x - ${cx.toFixed(4)}) + ${cy.toFixed(4)}`,
          `y = ${(-a / b).toFixed(4)}(x - ${cx.toFixed(4)}) + ${cy.toFixed(4)}`,
        ],
        equation: formatHyperbolaVertical(cx, cy, a, b),
      };
    }

    return {
      type: 'hyperbola',
      center: { x: cx, y: cy },
      a, b, c,
      isVertical: false,
      foci: [{ x: cx + c, y: cy }, { x: cx - c, y: cy }],
      eccentricity: ecc,
      asymptotes: [
        `y = ${(b / a).toFixed(4)}(x - ${cx.toFixed(4)}) + ${cy.toFixed(4)}`,
        `y = ${(-b / a).toFixed(4)}(x - ${cx.toFixed(4)}) + ${cy.toFixed(4)}`,
      ],
      equation: formatHyperbola(cx, cy, a, b),
    };
  }

  if (Math.abs(x2) > 1e-10 && Math.abs(y2) < 1e-10) {
    const cx = y !== 0 ? -x / (2 * x2) : -x / (2 * x2) || 0;
    const cy = y !== 0 ? -(x2 * cx * cx + x * cx + constant) / y : 0;
    const p = y !== 0 ? -y / (4 * x2) : 1 / (4 * x2);
    return {
      type: 'parabola',
      center: { x: cx, y: cy },
      a: p,
      isVertical: true,
      foci: [{ x: cx, y: cy + p }],
      equation: formatParabolaVertical(cx, cy, p),
    };
  }

  if (Math.abs(y2) > 1e-10 && Math.abs(x2) < 1e-10) {
    const cy = x !== 0 ? -y / (2 * y2) : -y / (2 * y2) || 0;
    const cx = x !== 0 ? -(y2 * cy * cy + y * cy + constant) / x : 0;
    const p = x !== 0 ? -x / (4 * y2) : 1 / (4 * y2);
    return {
      type: 'parabola',
      center: { x: cx, y: cy },
      a: p,
      isVertical: false,
      foci: [{ x: cx + p, y: cy }],
      equation: formatParabolaHorizontal(cx, cy, p),
    };
  }

  return null;
}

function formatCircle(cx: number, cy: number, r: number): string {
  const h = cx === 0 ? 'x' : `(x - ${fmt(cx)})`;
  const k = cy === 0 ? 'y' : `(y - ${fmt(cy)})`;
  return `${h}² + ${k}² = ${fmt(r)}²`;
}

function formatEllipse(cx: number, cy: number, a: number, b: number): string {
  const h = cx === 0 ? 'x' : `(x - ${fmt(cx)})`;
  const k = cy === 0 ? 'y' : `(y - ${fmt(cy)})`;
  return `${h}²/${fmt(a)}² + ${k}²/${fmt(b)}² = 1`;
}

function formatParabolaVertical(h: number, k: number, p: number): string {
  const x = h === 0 ? 'x²' : `(x - ${fmt(h)})²`;
  const rhs = `4·${fmt(Math.abs(p))}·(y - ${fmt(k)})`;
  return `${x} = ${rhs}`;
}

function formatParabolaHorizontal(h: number, k: number, p: number): string {
  const y = k === 0 ? 'y²' : `(y - ${fmt(k)})²`;
  const rhs = `4·${fmt(Math.abs(p))}·(x - ${fmt(h)})`;
  return `${y} = ${rhs}`;
}

function formatHyperbola(cx: number, cy: number, a: number, b: number): string {
  const h = cx === 0 ? 'x' : `(x - ${fmt(cx)})`;
  const k = cy === 0 ? 'y' : `(y - ${fmt(cy)})`;
  return `${h}²/${fmt(a)}² - ${k}²/${fmt(b)}² = 1`;
}

function formatHyperbolaVertical(cx: number, cy: number, a: number, b: number): string {
  const h = cx === 0 ? 'x' : `(x - ${fmt(cx)})`;
  const k = cy === 0 ? 'y' : `(y - ${fmt(cy)})`;
  return `${k}²/${fmt(a)}² - ${h}²/${fmt(b)}² = 1`;
}

export interface ConicDomainRange {
  a: number;
  b: number;
}

export function detectConicDomain(ast: ExpressionNode): ConicDomainRange[] | null {
  const conic = detectConic(ast);
  if (!conic) return null;

  const cx = conic.center?.x ?? 0;

  if (conic.type === 'circle') {
    const r = conic.radius ?? 0;
    if (r <= 0) return null;
    return [{ a: cx - r, b: cx + r }];
  }

  if (conic.type === 'ellipse') {
    const { a, b } = conic;
    if (!a || !b || a <= 0 || b <= 0) return null;
    const rx = conic.isVertical ? b : a;
    return [{ a: cx - rx, b: cx + rx }];
  }

  if (conic.type === 'parabola') {
    return null;
  }

  if (conic.type === 'hyperbola') {
    if (conic.isVertical) return null;
    const { a } = conic;
    if (!a || a <= 0) return null;
    const span = Math.max(10 * a, 50);
    return [
      { a: cx - span, b: cx - a },
      { a: cx + a, b: cx + span },
    ];
  }

  return null;
}

function fmt(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v));
  return v.toFixed(4);
}
