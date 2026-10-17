/**
 * Arc length and lateral surface of revolution of one curve, by the textbook integrals
 * L = ∫ ds and S = 2π ∫ ρ ds (ρ = distance to the axis), with the symbolic derivative for ds and
 * the adaptive quadrature for the integral. Pure math: no DOM/Angular.
 *
 * ds per mode: √(1 + f′²) dx, √(1 + g′²) dy, √(x′² + y′²) dt, √(r² + r′²) dt. An integrable
 * singular ds (√x at 0) is the quadrature's job; a divergent or undefined integral keeps its
 * status (never a truncated number). Throws `DifferentiationError` for functions with no
 * derivative in the engine.
 */
import { compileExpression } from './evaluator';
import type { ExpressionNode } from './parser';
import { integrateAdaptive, type QuadratureResult } from './quadrature';
import { add, differentiate } from './symbolic-diff';

type Node = ExpressionNode;
type Fn1 = (s: number) => number;

/** A curve as the length tools read it (variable names as in the function rows). */
export type ArcCurve =
  /** y = f(x); bounds in x */
  | { mode: 'explicit'; f: Node }
  /** x = g(y); bounds in y */
  | { mode: 'explicit-y'; g: Node }
  /** (x(t), y(t)); `x` in a component also reads as the parameter, like the evaluator */
  | { mode: 'parametric'; x: Node; y: Node }
  /** r = r(t); bounds in t */
  | { mode: 'polar'; r: Node };

/** Axis of revolution: the line y = value ('horizontal') or x = value ('vertical'). */
export interface RevolutionAxis {
  orientation: 'horizontal' | 'vertical';
  value: number;
}

interface Trace {
  /** Point of the curve at the integration variable s. */
  x: Fn1;
  y: Fn1;
  /** ds/d(s) ≥ 0. */
  speed: Fn1;
}

/** d/d(parameter): `t` and `x` both read as the parameter in a parametric / polar row. */
function dParam(n: Node): Node {
  return add(differentiate(n, 't'), differentiate(n, 'x'));
}

function trace(curve: ArcCurve): Trace {
  switch (curve.mode) {
    case 'explicit': {
      const f = compileExpression(curve.f);
      const df = compileExpression(differentiate(curve.f, 'x'));
      return { x: (s) => s, y: (s) => f(s, NaN), speed: (s) => Math.hypot(1, df(s, NaN)) };
    }
    case 'explicit-y': {
      const g = compileExpression(curve.g);
      const dg = compileExpression(differentiate(curve.g, 'y'));
      return { x: (s) => g(NaN, s), y: (s) => s, speed: (s) => Math.hypot(1, dg(NaN, s)) };
    }
    case 'parametric': {
      const [x, y] = [compileExpression(curve.x), compileExpression(curve.y)];
      const [dx, dy] = [compileExpression(dParam(curve.x)), compileExpression(dParam(curve.y))];
      return {
        x: (t) => x(t, NaN),
        y: (t) => y(t, NaN),
        speed: (t) => Math.hypot(dx(t, NaN), dy(t, NaN)),
      };
    }
    case 'polar': {
      const r = compileExpression(curve.r);
      const dr = compileExpression(dParam(curve.r));
      return {
        x: (t) => r(t, NaN) * Math.cos(t),
        y: (t) => r(t, NaN) * Math.sin(t),
        // √(r² + r′²) rather than √(x′² + y′²): same value, fewer cancellations.
        speed: (t) => Math.hypot(r(t, NaN), dr(t, NaN)),
      };
    }
  }
}

/** A NaN position makes ds NaN too: the curve is undefined there, whatever f′ says. */
function guarded(tr: Trace, weight: Fn1): Fn1 {
  return (s) => {
    const w = weight(s);
    return Number.isNaN(tr.x(s)) || Number.isNaN(tr.y(s)) ? NaN : w * tr.speed(s);
  };
}

/** Length of the curve between the bounds (in x, y or the parameter); a > b gives −L. */
export function arcLength(curve: ArcCurve, a: number, b: number): QuadratureResult {
  const tr = trace(curve);
  return integrateAdaptive(
    guarded(tr, () => 1),
    a,
    b,
  );
}

/** Lateral area 2π∫ρ ds of the curve revolved about `axis` (no caps, no inner walls). */
export function lateralSurface(
  curve: ArcCurve,
  a: number,
  b: number,
  axis: RevolutionAxis,
): QuadratureResult {
  const tr = trace(curve);
  const rho: Fn1 =
    axis.orientation === 'horizontal'
      ? (s) => Math.abs(tr.y(s) - axis.value)
      : (s) => Math.abs(tr.x(s) - axis.value);
  const r = integrateAdaptive(guarded(tr, rho), a, b);
  return { ...r, value: 2 * Math.PI * r.value, error: 2 * Math.PI * r.error };
}
