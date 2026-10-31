import { canvasPalette } from './palette';

/** Draws a coordinate label near (screenX, screenY), flipping to the opposite side
 *  when it would otherwise overflow the canvas edges. */
function drawCoordinateLabel(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  text: string,
  color: string,
  width: number,
  height: number,
): void {
  ctx.font = '11px "JetBrains Mono", monospace';
  const metrics = ctx.measureText(text);
  const pad = 4;
  const labelW = metrics.width + pad * 2;
  const labelH = 15;
  const offset = 12;

  const overflowsRight = screenX + offset + labelW > width;
  const overflowsTop = screenY - offset - labelH < 0;

  const lx = overflowsRight ? screenX - offset - labelW : screenX + offset;
  const topY = overflowsTop ? screenY + offset : screenY - offset - labelH;

  ctx.fillStyle = canvasPalette().labelBg;
  ctx.strokeStyle = canvasPalette().labelBorder;
  ctx.lineWidth = 1;
  ctx.fillRect(lx, topY, labelW, labelH);
  ctx.strokeRect(lx, topY, labelW, labelH);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + pad, topY + labelH / 2);
}

/** Draws the Desmos-style trace dot + coordinate label for the curve point nearest
 *  the pointer. */
export function drawTracePoint(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  worldX: number,
  worldY: number,
  color: string,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
  ctx.fill();

  const label = `(${worldX.toFixed(3)}, ${worldY.toFixed(3)})`;
  drawCoordinateLabel(ctx, screenX, screenY, label, color, width, height);
  ctx.restore();
}

/** Draws a small hollow grey dot for a point of interest (root, extremum,
 *  intersection); highlighted white and with a pinned label when active/pinned. */
export function drawPointOfInterest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  worldX: number,
  worldY: number,
  label: string | null,
  active: boolean,
  width: number,
  height: number,
): void {
  const palette = canvasPalette();
  ctx.save();
  ctx.strokeStyle = active ? palette.poiActive : palette.poi;
  ctx.lineWidth = active ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(screenX, screenY, active ? 5 : 4, 0, Math.PI * 2);
  ctx.stroke();

  if (label) {
    drawCoordinateLabel(ctx, screenX, screenY, label, palette.poiActive, width, height);
  }
  ctx.restore();
}
