import { getGrain, outlinePath, shade, type PaperRect } from "./brush";
import { getPaint } from "./palette";
import type { Stroke } from "./types";

/**
 * Draw one stroke onto a context, in paper-pixel coordinates.
 *
 * Three cheap layers turn a flat fill into something that reads as paint:
 *
 *   1. the pigment itself, at an opacity nudged by the stroke's own jitter;
 *   2. grain multiplied into it, so the fill is not perfectly even;
 *   3. a darker rim drawn just inside the edge, imitating the way real paint
 *      pools slightly where the brush lifted away from the surface.
 *
 * All three are clipped to the stroke's own outline, so a stroke can never
 * bleed onto its neighbours.
 */
/**
 * Everything drawing needs to know about a stroke, and nothing more.
 *
 * Narrower than `Stroke` on purpose: the stroke under the pointer has no music
 * yet — it has not been committed, so no phrase has been written for it — and
 * requiring one here would mean fabricating a melody just to draw a line.
 */
export type DrawableStroke = Pick<Stroke, "points" | "colorId" | "sizeId" | "jitter">;

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawableStroke,
  paper: PaperRect,
  options: { last?: boolean; hasRealPressure?: boolean } = {},
): void {
  const built = outlinePath(
    stroke.points,
    paper,
    stroke.sizeId,
    options.hasRealPressure ?? false,
    options.last ?? true,
  );
  if (!built) return;

  const { path, bounds } = built;
  const paint = getPaint(stroke.colorId);

  ctx.save();

  // 1 — pigment.
  ctx.fillStyle = paint.hex;
  ctx.globalAlpha = 0.9 + stroke.jitter * 0.1;
  ctx.fill(path);

  // 2 and 3 are confined to the stroke.
  ctx.clip(path);

  const grain = getGrain(ctx);
  if (grain) {
    ctx.globalCompositeOperation = "multiply";

    // Two passes of the same tile. The broad one carries the visible
    // mottling; the fine one keeps it from looking like a blurred photo.
    // Each stroke offsets the tile by its own jitter so no two strokes share
    // the same speckle pattern.
    const offset = stroke.jitter * 128;
    for (const [scale, alpha] of [
      [5.5, 0.3],
      [1, 0.14],
    ] as const) {
      if (typeof grain.setTransform === "function") {
        grain.setTransform(new DOMMatrix([scale, 0, 0, scale, offset, offset * 0.6]));
      }
      ctx.globalAlpha = alpha + stroke.jitter * 0.06;
      ctx.fillStyle = grain;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  }

  // The rim is stroked and clipped, so only the half inside the outline
  // survives — an outer edge would fatten the stroke and fight the taper. It
  // has to be a darker colour than the fill, not the same one at low alpha,
  // or it contributes nothing.
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = shade(paint.hex, 0.35);
  ctx.lineWidth = 3;
  ctx.stroke(path);

  ctx.restore();
}

/** Repaint every committed stroke from scratch. Used on resize, undo and load. */
export function drawAll(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  paper: PaperRect,
  dpr: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, paper.width, paper.height);
  for (const stroke of strokes) drawStroke(ctx, stroke, paper);
}

/**
 * Which stroke is under this point, topmost first.
 *
 * The eraser removes whole strokes rather than pixels, because a stroke and its
 * phrase are one object — rubbing away half a stroke would leave a melody with
 * nothing visible to explain it.
 */
export function hitTest(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  paper: PaperRect,
  point: { x: number; y: number },
): Stroke | null {
  const px = point.x * paper.width;
  const py = point.y * paper.height;

  ctx.save();
  // `isPointInPath` applies the current transform to the path but *not* to the
  // point it is given. With the usual device-pixel-ratio transform still in
  // place the two would disagree by a factor of `dpr`, and the eraser would
  // miss every stroke on a retina screen. Testing under the identity transform
  // keeps path and point in the same units.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const built = outlinePath(strokes[i].points, paper, strokes[i].sizeId, false, true);
      if (built && ctx.isPointInPath(built.path, px, py)) return strokes[i];
    }
    return null;
  } finally {
    ctx.restore();
  }
}
