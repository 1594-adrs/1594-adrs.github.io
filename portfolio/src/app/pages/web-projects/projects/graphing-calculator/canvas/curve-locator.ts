import { Viewport } from './viewport';

/** A curve that can be traced: `explicit` maps x -> y, `explicit-y` maps y -> x. */
export interface TraceCurve {
  index: number;
  color: string;
  mode: 'explicit' | 'explicit-y';
  fn: (v: number) => number;
}

export interface TracePoint {
  curveIndex: number;
  color: string;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  distancePx: number;
}

/** How far (in screen px, along the sweep axis) to search around the pointer for the
 *  curve's nearest sample before falling back to "no curve nearby". */
const SEARCH_RADIUS_PX = 40;
const SEARCH_STEP_PX = 2;

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
        };
      }
    }
  }

  return best;
}
