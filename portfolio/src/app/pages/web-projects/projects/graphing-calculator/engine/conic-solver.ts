import type { ExpressionNode } from './parser';
import { detectConic } from './conic-detector';

export interface ExplicitBranch {
  fn: (x: number) => number | null;
  label: string;
}

function fmt(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v));
  return v.toFixed(4);
}

export function solveConicForY(ast: ExpressionNode): ExplicitBranch[] | null {
  const conic = detectConic(ast);
  if (!conic) return null;

  const { type, center } = conic;
  const cx = center?.x ?? 0;
  const cy = center?.y ?? 0;

  if (type === 'circle') {
    const r = conic.radius ?? 0;
    if (r <= 0) return null;
    return [
      {
        fn: (x) => {
          const d = r * r - (x - cx) * (x - cx);
          return d >= 0 ? cy + Math.sqrt(d) : null;
        },
        label: `y = ${fmt(cy)} + √(${fmt(r)}² - (x - ${fmt(cx)})²)`,
      },
      {
        fn: (x) => {
          const d = r * r - (x - cx) * (x - cx);
          return d >= 0 ? cy - Math.sqrt(d) : null;
        },
        label: `y = ${fmt(cy)} - √(${fmt(r)}² - (x - ${fmt(cx)})²)`,
      },
    ];
  }

  if (type === 'ellipse') {
    const { a, b } = conic;
    if (!a || !b || a <= 0 || b <= 0) return null;
    const rx = conic.isVertical ? b : a;
    const ry = conic.isVertical ? a : b;
    return [
      {
        fn: (x) => {
          const d = 1 - ((x - cx) * (x - cx)) / (rx * rx);
          return d >= 0 ? cy + ry * Math.sqrt(d) : null;
        },
        label: `y = ${fmt(cy)} + ${fmt(ry)}√(1 - (x - ${fmt(cx)})²/${fmt(rx)}²)`,
      },
      {
        fn: (x) => {
          const d = 1 - ((x - cx) * (x - cx)) / (rx * rx);
          return d >= 0 ? cy - ry * Math.sqrt(d) : null;
        },
        label: `y = ${fmt(cy)} - ${fmt(ry)}√(1 - (x - ${fmt(cx)})²/${fmt(rx)}²)`,
      },
    ];
  }

  if (type === 'parabola') {
    const p = conic.a ?? 0;
    if (p === 0) return null;
    if (conic.isVertical) {
      return [
        {
          fn: (x) => cy + ((x - cx) * (x - cx)) / (4 * p),
          label: `y = ${fmt(cy)} + (x - ${fmt(cx)})²/${fmt(4 * p)}`,
        },
      ];
    }
    return [
      {
        fn: (x) => {
          const inner = 4 * p * (x - cx);
          return inner >= 0 ? cy + Math.sqrt(inner) : null;
        },
        label: `y = ${fmt(cy)} + √(${fmt(4 * p)}(x - ${fmt(cx)}))`,
      },
      {
        fn: (x) => {
          const inner = 4 * p * (x - cx);
          return inner >= 0 ? cy - Math.sqrt(inner) : null;
        },
        label: `y = ${fmt(cy)} - √(${fmt(4 * p)}(x - ${fmt(cx)}))`,
      },
    ];
  }

  if (type === 'hyperbola') {
    const { a, b } = conic;
    if (!a || !b || a <= 0 || b <= 0) return null;
    if (conic.isVertical) {
      return [
        {
          fn: (x) => {
            const inner = 1 + ((x - cx) * (x - cx)) / (b * b);
            return cy + a * Math.sqrt(inner);
          },
          label: `y = ${fmt(cy)} + ${fmt(a)}√(1 + (x - ${fmt(cx)})²/${fmt(b)}²)`,
        },
        {
          fn: (x) => {
            const inner = 1 + ((x - cx) * (x - cx)) / (b * b);
            return cy - a * Math.sqrt(inner);
          },
          label: `y = ${fmt(cy)} - ${fmt(a)}√(1 + (x - ${fmt(cx)})²/${fmt(b)}²)`,
        },
      ];
    }
    return [
      {
        fn: (x) => {
          const d = ((x - cx) * (x - cx)) / (a * a) - 1;
          return d >= 0 ? cy + b * Math.sqrt(d) : null;
        },
        label: `y = ${fmt(cy)} + ${fmt(b)}√((x - ${fmt(cx)})²/${fmt(a)}² - 1)`,
      },
      {
        fn: (x) => {
          const d = ((x - cx) * (x - cx)) / (a * a) - 1;
          return d >= 0 ? cy - b * Math.sqrt(d) : null;
        },
        label: `y = ${fmt(cy)} - ${fmt(b)}√((x - ${fmt(cx)})²/${fmt(a)}² - 1)`,
      },
    ];
  }

  return null;
}
