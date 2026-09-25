import type { ExpressionNode } from '../engine/parser';

export type CurveMode = 'explicit' | 'explicit-y' | 'implicit' | 'parametric' | 'polar';
export type OverlapMode = 'pairwise' | 'all';

export interface MathExpression {
  raw: string;
  ast: ExpressionNode | null;
  color: string;
  visible: boolean;
  mode: CurveMode;
  paramX?: ExpressionNode | null;
  paramY?: ExpressionNode | null;
  tMin?: string;
  tMax?: string;
  thetaMin?: string;
  thetaMax?: string;
  inequalityOp?: '>' | '<' | '>=' | '<=';
  /** Inline validation message (parse or unknown-variable/function), or null when valid. */
  error: string | null;
}

export interface IntegralResult {
  label: string;
  value: string;
}

export interface MultiFunctionAreaConfig {
  functionIndices: number[];
  a: number;
  b: number;
  autoDetectIntersections: boolean;
  overlapMode: OverlapMode;
}

export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola';
