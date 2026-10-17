import { Injectable, Signal, computed, signal } from '@angular/core';
import { arcLength } from '../engine/arc-length';
import { computeCentroid, type CentroidResult } from '../engine/centroid';
import { compileExpression } from '../engine/evaluator';
import { integrateAdaptive } from '../engine/quadrature';
import { riemannSum, type RiemannPanel, type RiemannRule } from '../engine/riemann';
import { DifferentiationError } from '../engine/symbolic-diff';
import type { MathExpression } from '../models/calculator.models';
import { formatValue } from '../utils/format-value';
import { statusValueText } from '../utils/result-format';
import { RADIANS_REASON, usesAngleUnit } from './derivative-view';

export type { RiemannRule };

export const MAX_RIEMANN_N = 1000;

export interface ActiveIntegral {
  fnIndex: number;
  a: number;
  b: number;
}

export interface RiemannView {
  rule: RiemannRule;
  n: number;
  /** NaN when n is invalid or the sum does not exist. */
  value: number;
  /** Exact (adaptive) integral of the same row; NaN when it diverges or is undefined. */
  exact: number;
  /** `exact` as display text ('divergent', 'undefined near x ≈ …' or the number). */
  exactText: string;
  /** Panel width (b − a) / n; NaN while n is invalid. */
  dx: number;
  /** |value − exact|; null unless both are finite. */
  error: number | null;
  /** |value − exact| / |exact|; null when exact is (numerically) 0 or error is null. */
  relError: number | null;
  status: 'ok' | 'undefined';
  panels: RiemannPanel[];
  /** Inline error (invalid n, undefined sum), null when fine. */
  message: string | null;
  /** True when `message` is about the n text itself (the input gets aria-invalid). */
  invalidN: boolean;
  /** Non-error remark, e.g. the exact integral diverges. */
  note: string | null;
}

export interface ArcLengthView {
  value: number;
  status: string;
  text: string;
  /** `text` is a full sentence (no value): shown on its own, without the "Arc length" prefix. */
  standalone: boolean;
}

/** Centroid of the area tool's region; null unless the tool has a usable curve selection. */
export function centroidFor(
  geom: {
    mode: 'multi' | 'single';
    a: number;
    b: number;
    evalFns?: Array<(s: number) => number>;
    fn?: (s: number) => number;
  } | null,
): CentroidResult | null {
  if (!geom) return null;
  if (geom.mode === 'multi' && geom.evalFns) return computeCentroid(geom.evalFns, geom.a, geom.b);
  if (geom.mode === 'single' && geom.fn) return computeCentroid([geom.fn, () => 0], geom.a, geom.b);
  return null;
}

/** Riemann sums and arc length of the integral tool's curve. */
@Injectable()
export class IntegralExtrasState {
  /** null = Riemann overlay off. */
  readonly riemannRule = signal<RiemannRule | null>(null);
  readonly riemannNText = signal('8');

  private functions: Signal<MathExpression[]> = signal([]);
  private angleUnit: Signal<'rad' | 'deg'> = signal('rad');
  private integral: Signal<ActiveIntegral | null> = signal(null);

  connect(
    functions: Signal<MathExpression[]>,
    angleUnit: Signal<'rad' | 'deg'>,
    activeIntegral: Signal<ActiveIntegral | null>,
  ): void {
    this.functions = functions;
    this.angleUnit = angleUnit;
    this.integral = activeIntegral;
  }

  /** The integral tool's row, with the component's `results` rules (visible, has ast, not x = g(y)). */
  private row = computed(() => {
    const intg = this.integral();
    const expr = intg ? this.functions()[intg.fnIndex] : undefined;
    return intg && expr?.ast && expr.visible && expr.mode !== 'explicit-y'
      ? { intg, expr, ast: expr.ast }
      : null;
  });

  riemann = computed<RiemannView | null>(() => {
    const rule = this.riemannRule();
    const row = this.row();
    if (!rule || !row) return null;
    const { intg, ast } = row;
    const compiled = compileExpression(ast, this.angleUnit());
    const fn = (x: number) => compiled(x, 0);
    const q = integrateAdaptive(fn, intg.a, intg.b);
    const converged = q.status === 'ok' || q.status === 'inaccurate';
    const exact = converged ? q.value : NaN;
    const base = {
      rule,
      exact,
      exactText: statusValueText(q.status, q.value, q.badPoint),
      error: null,
      relError: null,
      note: converged
        ? null
        : 'The integral does not converge, so there is no exact value to compare.',
    };

    if (!Number.isFinite(intg.a) || !Number.isFinite(intg.b)) {
      return {
        ...base,
        n: NaN,
        dx: Infinity,
        value: NaN,
        status: 'undefined',
        panels: [],
        message: 'Riemann sums need finite limits.',
        invalidN: false,
      };
    }

    const text = this.riemannNText().trim();
    const n = /^\d+$/.test(text) ? Number(text) : NaN;
    let message: string | null = null;
    if (!Number.isInteger(n) || n < 1 || n > MAX_RIEMANN_N) {
      message = `n must be a whole number from 1 to ${MAX_RIEMANN_N}.`;
    } else if (rule === 'simpson' && n % 2) {
      message = "Simpson's rule needs an even n.";
    }
    if (message) {
      return {
        ...base,
        n: NaN,
        dx: NaN,
        value: NaN,
        status: 'undefined',
        panels: [],
        message,
        invalidN: true,
      };
    }

    const r = riemannSum(fn, intg.a, intg.b, n, rule);
    const ok = r.status === 'ok' && Number.isFinite(exact);
    const error = ok ? Math.abs(r.value - exact) : null;
    // Relative error only when the exact value is not round-off around 0 (∫ sin over a period):
    // compare it with the size of the integrand over the interval.
    const dx = (intg.b - intg.a) / n;
    const scale = r.panels.reduce((s, p) => s + Math.abs(p.ys[0] ?? 0), 0) * Math.abs(dx);
    const relevant = Math.abs(exact) > 1e-9 * Math.max(scale, 1e-300);
    return {
      ...base,
      n,
      dx,
      value: r.value,
      status: r.status,
      panels: r.panels,
      error,
      relError: error !== null && relevant ? error / Math.abs(exact) : null,
      message:
        r.status === 'undefined'
          ? `f is undefined near x ≈ ${formatValue(r.badPoint ?? NaN)}.`
          : null,
      invalidN: false,
    };
  });

  arcLength = computed<ArcLengthView | null>(() => {
    const row = this.row();
    if (!row) return null;
    const { intg, ast } = row;
    if (this.angleUnit() === 'deg' && usesAngleUnit(ast)) {
      return { value: NaN, status: 'undefined', text: RADIANS_REASON, standalone: true };
    }
    try {
      const r = arcLength(
        { mode: 'explicit', f: ast },
        Math.min(intg.a, intg.b),
        Math.max(intg.a, intg.b),
      );
      return {
        value: r.value,
        status: r.status,
        text: statusValueText(r.status, r.value, r.badPoint),
        standalone: false,
      };
    } catch (e) {
      if (!(e instanceof DifferentiationError)) throw e;
      return {
        value: NaN,
        status: 'undefined',
        text: 'No arc length: this f is not symbolically differentiable.',
        standalone: true,
      };
    }
  });
}
