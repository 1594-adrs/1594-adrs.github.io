import type { CrossSectionShape, IntegrationVariable, SolidMethod } from '../../engine/solids';

/**
 * Exercise dataset contract: textbook / open-licensed exercises expressed as calculator input
 * plus the operation to run and the expected answer. Used by the dataset spec (regression +
 * gap report) and by the in-app examples library.
 *
 * Conventions
 * - Every expression is a string in calculator syntax: `^`, `*`, `sqrt`, `root(n,x)`, `ln`,
 *   `log` (base 10), `logb(b,x)`, `asin`…, `pi`, `e`, uppercase `E` for scientific notation.
 * - `curves` use the function-row forms: `y = f(x)`, `x = g(y)`, `F(x,y) = G(x,y)`, inequalities,
 *   `r = f(t)` (polar, angle `t`), `(f(t), g(t))` (parametric).
 * - Syntax the calculator does not support yet keeps one canonical spelling so it shows up as a
 *   gap instead of a typo: piecewise `if(cond, a, b)`, `asinh/acosh/atanh`, `cbrt`, sequences in
 *   `n`, ODE right-hand sides in `x, y`.
 * - Free parameters are any single letter except x, y, t, r, e (and `n` in sequences): sliders in
 *   the app. The runner samples them at a few non-integer values and substitutes them into curves,
 *   bounds and answers. Keep the book's letters; a numeric answer that only holds for a particular
 *   parameter value (the book gives it in the text) is reported as the `param:solve` gap.
 * - Bounds and answers are constant expressions (`'pi/2'`, `'16*pi/3'`); `'inf'`, `'-inf'` and
 *   `'dne'` (does not exist) are allowed in answers and `'inf'`/`'-inf'` in bounds.
 */

export type ExerciseSource = 'thomas12' | 'openstax1' | 'openstax2' | 'apex' | 'synthetic';

export interface ExerciseInterval {
  a: string;
  b: string;
}

export type ExerciseOp =
  /** Plot only: the curves must parse and be drawable. */
  | { kind: 'graph' }
  /** ∫_a^b of the single curve. */
  | ({ kind: 'integral' } & ExerciseInterval)
  /** Checks an indefinite integral: d/dx answer = curve, verified as ∫_a^b f = F(b) − F(a). */
  | ({ kind: 'antiderivative' } & ExerciseInterval)
  /** Area of the region bounded by the curves; bounds omitted → between their intersections. */
  | ({ kind: 'area'; wrt: IntegrationVariable } & Partial<ExerciseInterval>)
  /** Solid of revolution / known cross-sections (mirrors `SolidSpec` without curve functions). */
  | ({
      kind: 'volume' | 'surface';
      method: SolidMethod;
      variable: IntegrationVariable;
      axis?: { orientation: 'horizontal' | 'vertical'; value: string };
      /** 'circle' (diameter on the base, A = π·s²/4) is not a solids-engine shape yet. */
      shape?: CrossSectionShape | 'circle';
      heightRatio?: number;
      /** Surface only: the textbook surface of revolution of the curve (no caps or inner walls). */
      lateral?: boolean;
    } & ExerciseInterval)
  /** Length of the curve; for parametric/polar curves a, b are parameter bounds. */
  | ({ kind: 'arc-length' } & ExerciseInterval)
  /** ½∫ r² dt of a polar curve (or between two polar curves). */
  | ({ kind: 'polar-area' } & ExerciseInterval)
  /** Centroid (x̄, ȳ) of the region bounded by the curves. */
  | ({ kind: 'centroid' } & ExerciseInterval)
  /** x-coordinates of zeros or intersections in [a, b], or of local extrema in the open (a, b). */
  | ({ kind: 'roots' | 'extrema' | 'intersections' } & ExerciseInterval)
  /**
   * f⁽ⁿ⁾(x0) (x0 given; dy/dx at (x0, y0) for an implicit curve) or the derivative as a function
   * (x0 omitted, answer in `expected.fn`).
   */
  | { kind: 'derivative'; x0?: string; y0?: string; /** Default 1. */ order?: number }
  /**
   * Tangent (or `normal`) line at x0 (parameter value for parametric/polar; point (x0, y0) on an
   * implicit curve); answer = slope, or line in `fn`.
   */
  | { kind: 'tangent'; x0: string; y0?: string; normal?: boolean }
  /** lim_{x→x0} f(x); side '-' / '+' for one-sided limits. */
  | { kind: 'limit'; x0: string; side?: '-' | '+' }
  /** Newton's method from x0, `steps` iterations (omitted → until convergence). */
  | { kind: 'newton'; x0: string; steps?: number }
  | ({
      kind: 'riemann';
      rule: 'left' | 'right' | 'mid' | 'trap' | 'simpson';
      n: number;
    } & ExerciseInterval)
  /** Taylor polynomial of the curve at `center`. */
  | { kind: 'taylor'; center: string; order: number }
  /** dy/dx = f(x, y) with y(x0) = y0; answer = y(xEnd) or the solution in `fn`. */
  | {
      kind: 'ode';
      f: string;
      x0: string;
      y0: string;
      xEnd?: string;
      method?: 'euler' | 'rk4';
      h?: string;
    }
  /** Sequence aₙ (curve in `n`): limit, or partial sum S_nMax / series sum when kind = 'series'. */
  | { kind: 'sequence' | 'series'; nStart?: number; nMax?: number };

export type ExerciseOpKind = ExerciseOp['kind'];

export interface ExerciseExpected {
  /** Constant answers; several for roots / extrema / intersections (ascending x) or centroid [x̄, ȳ]. */
  values?: string[];
  /** Function answer in `x`, compared on sample points (derivative, tangent line, Taylor, ODE solution). */
  fn?: string;
  /** Relative tolerance; default 1e-4. Rounded book answers set it from the printed digits. */
  tol?: number;
  /** 'book' = answer key; 'derived' = computed by the transcriber (less trusted). */
  from: 'book' | 'derived';
}

export interface Exercise {
  /** `${source}-${section}-${number}`, e.g. 'thomas12-6.2-17b' or 'thomas12-6P-23' (chapter practice). */
  id: string;
  source: ExerciseSource;
  section: string;
  number: string;
  curves: string[];
  /** Parameter range for parametric / polar curves. */
  paramRange?: ExerciseInterval;
  op: ExerciseOp;
  expected?: ExerciseExpected;
  /** Statement, only for openly licensed sources (never for 'thomas12'). */
  prompt?: string;
  /** SPDX-like license tag + attribution URL for open sources. */
  license?: string;
}
