import { Viewport } from './viewport';

const CLAMP = 1e8;

/** CSS px per grid cell while panning/zooming/touching — coarser, cheap to redraw every frame. */
const GESTURE_CELL_PX = 4;
/** CSS px per grid cell once the gesture has settled — finer, drawn once and then cached. */
const IDLE_CELL_PX = 2;
const MIN_STEPS = 40;
const MAX_STEPS = 400;

function evalImplicit(fn: (x: number, y: number) => number, x: number, y: number): number {
  try {
    const v = fn(x, y);
    if (!isFinite(v)) return CLAMP;
    if (v > CLAMP) return CLAMP;
    if (v < -CLAMP) return -CLAMP;
    return v;
  } catch {
    return CLAMP;
  }
}

function lerp(
  v1: number,
  v2: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  level: number,
): [number, number] {
  const t = (level - v1) / (v2 - v1);
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

interface ContourCacheEntry {
  key: string;
  /** Screen-space segments, 4 numbers per segment: x0, y0, x1, y1. */
  segments: Float64Array;
  segmentCount: number;
}

// Keyed on the eval function's identity (stable across frames when callers pass a
// memoized/compiled closure for the same expression), so an unchanged viewport at
// an unchanged size — e.g. redraws triggered only by a mouse-move crosshair, with
// no pan/zoom — reuses the previous contour instead of re-running marching squares.
const contourCache = new WeakMap<object, ContourCacheEntry>();

function computeContourSegments(
  viewport: Viewport,
  fn: (x: number, y: number) => number,
  stepsX: number,
  stepsY: number,
  width: number,
  height: number,
): Float64Array {
  const cols = stepsX + 1;
  const rows = stepsY + 1;
  const dx = (viewport.xMax - viewport.xMin) / stepsX;
  const dy = (viewport.yMax - viewport.yMin) / stepsY;
  const val = new Float64Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    const wy = viewport.yMax - row * dy;
    const base = row * cols;
    for (let col = 0; col < cols; col++) {
      val[base + col] = evalImplicit(fn, viewport.xMin + col * dx, wy);
    }
  }

  // Growable buffer of world-space segment endpoints; converted to screen space
  // (and trimmed to a right-sized Float64Array) once the sweep is done.
  const world: number[] = [];
  const level = 0;

  for (let row = 0; row < stepsY; row++) {
    const base = row * cols;
    const baseNext = base + cols;
    for (let col = 0; col < stepsX; col++) {
      const tl = val[base + col];
      const tr = val[base + col + 1];
      const br = val[baseNext + col + 1];
      const bl = val[baseNext + col];

      const caseIndex =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0);

      if (caseIndex === 0 || caseIndex === 15) continue;

      const wx0 = viewport.xMin + col * dx;
      const wy0 = viewport.yMax - row * dy;
      const wx1 = wx0 + dx;
      const wy1 = wy0 - dy;

      const pushSeg = (a: [number, number], b: [number, number]) => {
        world.push(a[0], a[1], b[0], b[1]);
      };

      switch (caseIndex) {
        case 1:
        case 14:
          pushSeg(lerp(tl, bl, wx0, wy0, wx0, wy1, level), lerp(bl, br, wx0, wy1, wx1, wy1, level));
          break;
        case 2:
        case 13:
          pushSeg(lerp(bl, br, wx0, wy1, wx1, wy1, level), lerp(br, tr, wx1, wy1, wx1, wy0, level));
          break;
        case 3:
        case 12:
          pushSeg(lerp(tl, bl, wx0, wy0, wx0, wy1, level), lerp(tr, br, wx1, wy0, wx1, wy1, level));
          break;
        case 4:
        case 11:
          pushSeg(lerp(tr, tl, wx1, wy0, wx0, wy0, level), lerp(br, tr, wx1, wy1, wx1, wy0, level));
          break;
        case 5:
          pushSeg(lerp(tl, bl, wx0, wy0, wx0, wy1, level), lerp(tr, tl, wx1, wy0, wx0, wy0, level));
          pushSeg(lerp(bl, br, wx0, wy1, wx1, wy1, level), lerp(br, tr, wx1, wy1, wx1, wy0, level));
          break;
        case 6:
        case 9:
          pushSeg(lerp(tr, tl, wx1, wy0, wx0, wy0, level), lerp(br, bl, wx1, wy1, wx0, wy1, level));
          break;
        case 7:
        case 8:
          pushSeg(lerp(tr, tl, wx1, wy0, wx0, wy0, level), lerp(tl, bl, wx0, wy0, wx0, wy1, level));
          break;
        case 10:
          pushSeg(lerp(tr, tl, wx1, wy0, wx0, wy0, level), lerp(br, tr, wx1, wy1, wx1, wy0, level));
          pushSeg(lerp(tl, bl, wx0, wy0, wx0, wy1, level), lerp(bl, br, wx0, wy1, wx1, wy1, level));
          break;
      }
    }
  }

  const screen = new Float64Array(world.length);
  for (let i = 0; i < world.length; i += 4) {
    const [sa, sb] = viewport.worldToScreen(world[i], world[i + 1], width, height);
    const [sc, sd] = viewport.worldToScreen(world[i + 2], world[i + 3], width, height);
    screen[i] = sa;
    screen[i + 1] = sb;
    screen[i + 2] = sc;
    screen[i + 3] = sd;
  }
  return screen;
}

/**
 * Draws the zero-contour of an implicit curve via marching squares. `coarse`
 * (true while a pan/zoom/touch gesture is in progress) trades grid resolution
 * for speed; the resulting contour is cached per (eval-fn identity, viewport,
 * size, coarseness) so an unrelated redraw — e.g. only the crosshair moving —
 * reuses it instead of re-running the sweep.
 */
export function drawImplicitCurve(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number, y: number) => number,
  color: string,
  width: number,
  height: number,
  coarse = false,
): void {
  ctx.strokeStyle = color;

  const cellPx = coarse ? GESTURE_CELL_PX : IDLE_CELL_PX;
  const stepsX = Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.round(width / cellPx)));
  const stepsY = Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.round(height / cellPx)));

  const key = `${viewport.xMin.toFixed(6)}:${viewport.xMax.toFixed(6)}:${viewport.yMin.toFixed(6)}:${viewport.yMax.toFixed(6)}:${width}:${height}:${stepsX}:${stepsY}`;

  let entry = contourCache.get(fn);
  if (!entry || entry.key !== key) {
    const segments = computeContourSegments(viewport, fn, stepsX, stepsY, width, height);
    entry = { key, segments, segmentCount: segments.length / 4 };
    contourCache.set(fn, entry);
  }

  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  const segs = entry.segments;
  for (let i = 0; i < segs.length; i += 4) {
    ctx.moveTo(segs[i], segs[i + 1]);
    ctx.lineTo(segs[i + 2], segs[i + 3]);
  }
  ctx.stroke();
}
