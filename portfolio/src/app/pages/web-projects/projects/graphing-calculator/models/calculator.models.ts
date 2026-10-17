import type { ExpressionNode } from '../engine/parser';

export type { ConicType } from '../engine/types';

export type CurveMode = 'explicit' | 'explicit-y' | 'implicit' | 'parametric' | 'polar' | 'slider';

/** Slider range of a `a = 2` row; the value itself lives in the row text. */
export interface SliderBounds {
  min: number;
  max: number;
  step: number;
}
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
  /** f′ toggle: also plot the derivative (explicit rows only). */
  showDerivative?: boolean;
  /** Inline validation message (parse or unknown-variable/function), or null when valid. */
  error: string | null;
  /** Slider rows only: the editable range (the value is parsed from `raw`). */
  slider?: SliderBounds;
  /** Free parameters this row uses that no slider row defines (drives the "add slider" action). */
  missingParams?: string[];
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
