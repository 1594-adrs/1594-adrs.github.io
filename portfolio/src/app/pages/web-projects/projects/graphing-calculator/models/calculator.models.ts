import type { ExpressionNode } from '../engine/parser';

export type RotationAxisType = 'x' | 'y' | 'custom';

export interface RotationAxis {
  type: RotationAxisType;
  value: number;
}

export type CurveMode = 'explicit' | 'implicit' | 'parametric' | 'polar';
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
}

export interface PlotRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface IntegralResult {
  label: string;
  value: string;
}

export interface SolidConfig {
  functionIndices: number[];
  a: number;
  b: number;
  axis: RotationAxis;
  overlapMode: OverlapMode;
  tMin?: string;
  tMax?: string;
  thetaMin?: string;
  thetaMax?: string;
}

export interface MultiFunctionAreaConfig {
  functionIndices: number[];
  a: number;
  b: number;
  autoDetectIntersections: boolean;
  overlapMode: OverlapMode;
}

export interface Point2D {
  x: number;
  y: number;
}
