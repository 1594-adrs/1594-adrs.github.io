import { Viewport } from './viewport';

/** A curve that can be traced: `explicit` maps x -> y, `explicit-y` maps y -> x,
 *  `parametric` maps the parameter t in [tMin, tMax] -> (x, y) (polar rows included). */
export type TraceCurve =
  | {
      index: number;
      color: string;
      mode: 'explicit' | 'explicit-y';
      fn: (v: number) => number;
    }
  | {
      index: number;
      color: string;
      mode: 'parametric';
      xy: (t: number) => [number, number];
      tMin: number;
      tMax: number;
    };

export interface TracePoint {
  curveIndex: number;
  color: string;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  distancePx: number;
  /** Parameter of the point: x (explicit), y (explicit-y) or t (parametric / polar). */
  param: number;
}

/** How far (in screen px, along the sweep axis) to search around the pointer for the
 *  curve's nearest sample before falling back to "no curve nearby". */
const SEARCH_RADIUS_PX = 40;
const SEARCH_STEP_PX = 2;
/** Parameter samples for a parametric curve, then a local refinement around the best one. */
const PARAM_SAMPLES = 720;
const PARAM_REFINE_ITERS = 24;

/**
 * Finds the point on the nearest visible curve within `maxDistancePx` of the pointer,
 * in screen space. Searches a window of the curve around the pointer's screen position
 * (sweeping x for `explicit` curves, y for `explicit-y` curves) rather than assuming the
 * curve is monotonic in screen space near the pointer.
 */
export function findNearestCurvePoint(
  curves: TraceCurve[],
  screenX: number,
  screenY: number,
  viewport: Viewport,
  width: number,
  height: number,
  maxDistancePx: number,
): TracePoint | null {
  let best: TracePoint | null = null;

  for (const curve of curves) {
    if (curve.mode === 'parametric') {
      const p = nearestOnParametric(curve, screenX, screenY, viewport, width, height);
      if (p && p.distancePx <= maxDistancePx && (!best || p.distancePx < best.distancePx)) {
        best = p;
      }
      continue;
    }
    for (let d = -SEARCH_RADIUS_PX; d <= SEARCH_RADIUS_PX; d += SEARCH_STEP_PX) {
      let worldX: number;
      let worldY: number;

      if (curve.mode === 'explicit-y') {
        const probeScreenY = screenY + d;
        if (probeScreenY < 0 || probeScreenY > height) continue;
        const [, wy] = viewport.screenToWorld(screenX, probeScreenY, width, height);
        let x: number;
        try {
          x = curve.fn(wy);
        } catch {
          continue;
        }
        if (!isFinite(x)) continue;
        worldX = x;
        worldY = wy;
      } else {
        const probeScreenX = screenX + d;
        if (probeScreenX < 0 || probeScreenX > width) continue;
        const [wx] = viewport.screenToWorld(probeScreenX, screenY, width, height);
        let y: number;
        try {
          y = curve.fn(wx);
        } catch {
          continue;
        }
        if (!isFinite(y)) continue;
        worldX = wx;
        worldY = y;
      }

      const [sx, sy] = viewport.worldToScreen(worldX, worldY, width, height);
      const distancePx = Math.hypot(sx - screenX, sy - screenY);
      if (distancePx <= maxDistancePx && (!best || distancePx < best.distancePx)) {
        best = {
          curveIndex: curve.index,
          color: curve.color,
          worldX,
          worldY,
          screenX: sx,
          screenY: sy,
          distancePx,
          param: curve.mode === 'explicit-y' ? worldY : worldX,
        };
      }
    }
  }

  return best;
}

/** Nearest sample of a parametric curve to the pointer, refined by a ternary search on the
 *  screen distance within one sample step of the best sample. */
function nearestOnParametric(
  curve: Extract<TraceCurve, { mode: 'parametric' }>,
  screenX: number,
  screenY: number,
  viewport: Viewport,
  width: number,
  height: number,
): TracePoint | null {
  const { tMin, tMax } = curve;
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) return null;
  const dist = (t: number): number => {
    let p: [number, number];
    try {
      p = curve.xy(t);
    } catch {
      return Infinity;
    }
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return Infinity;
    const [sx, sy] = viewport.worldToScreen(p[0], p[1], width, height);
    return Math.hypot(sx - screenX, sy - screenY);
  };
  const step = (tMax - tMin) / PARAM_SAMPLES;
  let bestT = NaN;
  let bestD = Infinity;
  for (let i = 0; i <= PARAM_SAMPLES; i++) {
    const t = tMin + i * step;
    const d = dist(t);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  if (!Number.isFinite(bestD)) return null;
  let lo = Math.max(tMin, bestT - step);
  let hi = Math.min(tMax, bestT + step);
  for (let i = 0; i < PARAM_REFINE_ITERS; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (dist(m1) < dist(m2)) hi = m2;
    else lo = m1;
  }
  const mid = (lo + hi) / 2;
  const t = dist(mid) <= bestD ? mid : bestT;
  const [worldX, worldY] = curve.xy(t);
  const [sx, sy] = viewport.worldToScreen(worldX, worldY, width, height);
  return {
    curveIndex: curve.index,
    color: curve.color,
    worldX,
    worldY,
    screenX: sx,
    screenY: sy,
    distancePx: Math.hypot(sx - screenX, sy - screenY),
    param: t,
  };
}
