import type { ExpressionNode } from '../parser';

/**
 * Shared contract for the "solids by integration" feature (engine, 2D/3D renderers, UI state).
 *
 * Conventions
 * - `variable` is the variable of integration t:
 *   'x' → curves are y = f(x), slices are perpendicular to the x-axis;
 *   'y' → curves are x = g(y), slices are perpendicular to the y-axis.
 * - For each t, the region is bounded by an "upper" boundary (larger curve value) and a
 *   "lower" boundary (smaller value). With a single curve the missing boundary is the
 *   baseline: the axis line value k for 'disk-washer', and 0 for 'shell' / 'cross-section'.
 * - Method / axis compatibility:
 *   disk-washer: variable 'x' ↔ horizontal axis (y = k); variable 'y' ↔ vertical axis (x = k).
 *   shell:       variable 'x' ↔ vertical axis (x = k);   variable 'y' ↔ horizontal axis (y = k).
 *   cross-section: no axis; base width s(t) = upper(t) − lower(t).
 */

export type IntegrationVariable = 'x' | 'y';

export type SolidMethod = 'disk-washer' | 'shell' | 'cross-section';

export type CrossSectionShape =
  | 'square' // A = s²
  | 'rectangle' // A = h·s², height = heightRatio · s
  | 'equilateral-triangle' // A = (√3/4)·s²
  | 'right-isosceles-leg' // leg on the base: A = s²/2
  | 'right-isosceles-hypotenuse' // hypotenuse on the base: A = s²/4
  | 'semicircle'; // diameter on the base: A = (π/8)·s²

/** Line of rotation: 'horizontal' is y = value, 'vertical' is x = value. */
export interface AxisLine {
  orientation: 'horizontal' | 'vertical';
  value: number;
}

/** A boundary curve as a function of the integration variable. */
export interface SolidCurve {
  fn: (t: number) => number;
  /** AST of the curve (in terms of `variable`) for formula rendering; null if not symbolic (parametric/polar samples). */
  ast: ExpressionNode | null;
  /** Display name, e.g. 'f₁'. */
  label: string;
  color: string;
}

export interface SolidSpec {
  method: SolidMethod;
  variable: IntegrationVariable;
  /** 1 or 2 curves. */
  curves: SolidCurve[];
  a: number;
  b: number;
  /** Required for 'disk-washer' and 'shell'. */
  axis?: AxisLine;
  /** Required for 'cross-section'. */
  shape?: CrossSectionShape;
  /** 'rectangle' only; > 0. */
  heightRatio?: number;
}

/** Sub-interval of [a, b] between consecutive curve crossings, with a fixed upper/lower ordering. */
export interface SolidPiece {
  a: number;
  b: number;
  /** Index into `SolidSpec.curves`; null = baseline (see conventions). */
  upperIndex: number | null;
  lowerIndex: number | null;
}

export type SolidIssueCode =
  | 'no-curves'
  | 'too-many-curves'
  | 'bounds-nan'
  | 'bounds-order'
  | 'missing-axis'
  | 'axis-orientation' // axis incompatible with method + variable
  | 'missing-shape'
  | 'bad-ratio'
  | 'curve-variable' // a curve is not expressed in the integration variable
  | 'undefined-domain' // curve is NaN somewhere in [a, b]
  | 'divergent' // integral diverges / pole in [a, b]
  | 'curves-cross' // info: region split at crossings
  | 'axis-inside-region'; // warning: axis cuts the region, solid overlaps itself

export interface SolidIssue {
  code: SolidIssueCode;
  severity: 'error' | 'warning' | 'info';
  /** User-facing message (English, like the rest of the UI), short and specific. */
  message: string;
  field?: 'curves' | 'a' | 'b' | 'axis' | 'shape' | 'ratio';
  /** Location (value of t) the issue refers to, when applicable. */
  at?: number;
}

/** One term of the volume formula: coefficient · ∫_a^b integrand d(variable). */
export interface SolidIntegralTerm {
  /** e.g. π, 2π or 1 (null → no coefficient shown). */
  coefficient: ExpressionNode | null;
  a: number;
  b: number;
  integrand: ExpressionNode;
  variable: IntegrationVariable;
}

export interface SolidResult {
  /** null when the computation failed (see issues). */
  volume: number | null;
  /** Absolute error estimate from the quadrature. */
  errorEstimate: number;
  /** Closed form when recognised, e.g. 'π/3', '16/3', '7π/15'. */
  exact: string | null;
  /** Formula terms; the volume is their sum. */
  terms: SolidIntegralTerm[];
  pieces: SolidPiece[];
  /** Cross-sectional area A(t) (disk/washer/cross-section) or shell lateral area 2π·r·h (shell), for the sweep readout. */
  sliceArea: (t: number) => number;
  /** Computation-time issues only (divergent, undefined-domain found by the quadrature). */
  issues: SolidIssue[];
}
