import type { RiemannPanel, RiemannRule } from '../engine/riemann';
import { Viewport } from './viewport';

/** Ink for markers that are not a function (same rule as the ODE solution). */
const COLOR_INK = '#e0e0e0';
const COLOR_HALO = '#0a0a0f';
/** The panels are an approximation, not a curve: neutral ink over the function's own shading. */
const PANEL_FILL = 'rgba(224, 224, 224, 0.12)';
const PANEL_STROKE = 'rgba(224, 224, 224, 0.85)';
/** Without dividers the profile hugs the curve; a fainter ink keeps the curve's own colour. */
const PANEL_STROKE_DENSE = 'rgba(224, 224, 224, 0.4)';
/** Below this on-screen panel width the dividers are dropped (n = 200 would smear into a slab);
 *  the outer profile is still drawn, so the staircase / polyline stays visible. */
const MIN_DIVIDER_PX = 5;
const CENTROID_RADIUS = 6;
const CENTROID_ARM = 11;
const SIMPSON_STEPS = 16;

/**
 * Riemann rectangles / trapezoids / Simpson parabolas as one translucent fill plus one stroke:
 * the top profile always, the panel dividers only while panels are wide enough to tell apart.
 * Single path per pass, so shared edges never double the alpha.
 */
export function drawRiemannPanels(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  panels: RiemannPanel[],
  rule: RiemannRule,
  width: number,
  height: number,
): void {
  const toScreen = (x: number, y: number) => viewport.worldToScreen(x, y, width, height);
  const [, oy] = toScreen(0, 0);
  const valid = panels.filter((p) => p.ys.every(Number.isFinite));
  if (!valid.length) return;
  const [p0a] = toScreen(valid[0].a, 0);
  const [p0b] = toScreen(valid[0].b, 0);
  const dividers = Math.abs(p0b - p0a) >= MIN_DIVIDER_PX;

  /** The panel's top edge from its left to its right side (the cursor is already at the left). */
  const top = (p: RiemannPanel, x0: number, x1: number): void => {
    if (rule === 'trap') {
      ctx.lineTo(x0, toScreen(p.a, p.ys[0])[1]);
      ctx.lineTo(x1, toScreen(p.b, p.ys[1])[1]);
    } else if (rule === 'simpson') {
      // The parabola through the three samples (Lagrange form), as a polyline.
      const [xa, xm, xb] = p.xs;
      const [ya, ym, yb] = p.ys;
      const cap = (x: number) =>
        (ya * (x - xm) * (x - xb)) / ((xa - xm) * (xa - xb)) +
        (ym * (x - xa) * (x - xb)) / ((xm - xa) * (xm - xb)) +
        (yb * (x - xa) * (x - xm)) / ((xb - xa) * (xb - xm));
      for (let i = 0; i <= SIMPSON_STEPS; i++) {
        const x = xa + ((xb - xa) * i) / SIMPSON_STEPS;
        const [sx, sy] = toScreen(x, cap(x));
        ctx.lineTo(sx, sy);
      }
    } else {
      const [, sy] = toScreen(0, p.ys[0]);
      ctx.lineTo(x0, sy);
      ctx.lineTo(x1, sy);
    }
  };

  // One closed outline per run of contiguous valid panels: axis → profile → axis.
  const outline = (withDividers: boolean): void => {
    ctx.beginPath();
    let prevB: number | null = null;
    let runEnd = 0;
    for (const p of valid) {
      const [x0] = toScreen(p.a, 0);
      const [x1] = toScreen(p.b, 0);
      if (prevB === null || p.a !== prevB) {
        if (prevB !== null) ctx.lineTo(runEnd, oy);
        ctx.moveTo(x0, oy);
      } else if (withDividers) {
        // Divider: back down to the axis and up again, inside the same path.
        ctx.lineTo(x0, oy);
      }
      top(p, x0, x1);
      prevB = p.b;
      runEnd = x1;
    }
    ctx.lineTo(runEnd, oy);
  };

  ctx.save();
  ctx.setLineDash([]);
  outline(false);
  ctx.fillStyle = PANEL_FILL;
  ctx.fill();
  outline(dividers);
  ctx.strokeStyle = dividers ? PANEL_STROKE : PANEL_STROKE_DENSE;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'miter';
  ctx.stroke();
  ctx.restore();
}

/** Ringed crosshair at the centroid (x̄, ȳ), with a dark halo so it reads over axes and fills. */
export function drawCentroid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const [sx, sy] = viewport.worldToScreen(x, y, width, height);
  const shape = (): void => {
    ctx.beginPath();
    ctx.arc(sx, sy, CENTROID_RADIUS, 0, Math.PI * 2);
    ctx.moveTo(sx - CENTROID_ARM, sy);
    ctx.lineTo(sx + CENTROID_ARM, sy);
    ctx.moveTo(sx, sy - CENTROID_ARM);
    ctx.lineTo(sx, sy + CENTROID_ARM);
  };
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  shape();
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLOR_HALO;
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLOR_INK;
  ctx.stroke();
  ctx.restore();
}
