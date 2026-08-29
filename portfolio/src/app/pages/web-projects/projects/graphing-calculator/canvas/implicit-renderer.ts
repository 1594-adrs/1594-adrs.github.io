import { Viewport } from './viewport';

const CLAMP = 1e8;

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

function drawContour(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number, y: number) => number,
  level: number,
  width: number,
  height: number,
  steps: number,
): void {
  const dx = (viewport.xMax - viewport.xMin) / steps;
  const dy = (viewport.yMax - viewport.yMin) / steps;
  const val: number[][] = [];

  for (let row = 0; row <= steps; row++) {
    val[row] = [];
    const wy = viewport.yMax - row * dy;
    for (let col = 0; col <= steps; col++) {
      const wx = viewport.xMin + col * dx;
      val[row][col] = evalImplicit(fn, wx, wy);
    }
  }

  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const tl = val[row][col];
      const tr = val[row][col + 1];
      const br = val[row + 1][col + 1];
      const bl = val[row + 1][col];

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

      const segments: Array<[[number, number], [number, number]]> = [];

      switch (caseIndex) {
        case 1:
        case 14:
          segments.push([
            lerp(tl, bl, wx0, wy0, wx0, wy1, level),
            lerp(bl, br, wx0, wy1, wx1, wy1, level),
          ]);
          break;
        case 2:
        case 13:
          segments.push([
            lerp(bl, br, wx0, wy1, wx1, wy1, level),
            lerp(br, tr, wx1, wy1, wx1, wy0, level),
          ]);
          break;
        case 3:
        case 12:
          segments.push([
            lerp(tl, bl, wx0, wy0, wx0, wy1, level),
            lerp(tr, br, wx1, wy0, wx1, wy1, level),
          ]);
          break;
        case 4:
        case 11:
          segments.push([
            lerp(tr, tl, wx1, wy0, wx0, wy0, level),
            lerp(br, tr, wx1, wy1, wx1, wy0, level),
          ]);
          break;
        case 5:
          segments.push([
            lerp(tl, bl, wx0, wy0, wx0, wy1, level),
            lerp(tr, tl, wx1, wy0, wx0, wy0, level),
          ]);
          segments.push([
            lerp(bl, br, wx0, wy1, wx1, wy1, level),
            lerp(br, tr, wx1, wy1, wx1, wy0, level),
          ]);
          break;
        case 6:
        case 9:
          segments.push([
            lerp(tr, tl, wx1, wy0, wx0, wy0, level),
            lerp(br, bl, wx1, wy1, wx0, wy1, level),
          ]);
          break;
        case 7:
        case 8:
          segments.push([
            lerp(tr, tl, wx1, wy0, wx0, wy0, level),
            lerp(tl, bl, wx0, wy0, wx0, wy1, level),
          ]);
          break;
        case 10:
          segments.push([
            lerp(tr, tl, wx1, wy0, wx0, wy0, level),
            lerp(br, tr, wx1, wy1, wx1, wy0, level),
          ]);
          segments.push([
            lerp(tl, bl, wx0, wy0, wx0, wy1, level),
            lerp(bl, br, wx0, wy1, wx1, wy1, level),
          ]);
          break;
      }

      for (const [[ax, ay], [bx, by]] of segments) {
        const [sa, sb_] = viewport.worldToScreen(ax, ay, width, height);
        const [sc, sd] = viewport.worldToScreen(bx, by, width, height);
        ctx.moveTo(sa, sb_);
        ctx.lineTo(sc, sd);
      }
    }
  }
  ctx.stroke();
}

export function drawImplicitCurve(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fn: (x: number, y: number) => number,
  color: string,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = color;
  const steps = Math.max(200, Math.min(500, width));
  drawContour(ctx, viewport, fn, 0, width, height, steps);
}
