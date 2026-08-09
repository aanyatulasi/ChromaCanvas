import { getStroke } from "perfect-freehand";
import type { BrushSizeId, RawPoint } from "./types";

/**
 * Brush widths as a fraction of the paper's width, not pixels.
 *
 * A stroke has to be the same weight relative to the artwork whether the paper
 * is 1400px wide on a laptop or 380px wide on a phone, and whether it is being
 * drawn now or redrawn from a save file on a different screen. Pixels cannot
 * express that; a fraction of the sheet can.
 */
export const BRUSH_SIZES: { id: BrushSizeId; label: string; width: number }[] = [
  { id: "fine", label: "Fine", width: 0.006 },
  { id: "small", label: "Small", width: 0.012 },
  { id: "medium", label: "Medium", width: 0.022 },
  { id: "large", label: "Large", width: 0.034 },
  { id: "broad", label: "Broad", width: 0.05 },
];

const BY_ID = new Map(BRUSH_SIZES.map((s) => [s.id, s]));

export function brushWidth(id: BrushSizeId): number {
  return (BY_ID.get(id) ?? BRUSH_SIZES[2]).width;
}

export const DEFAULT_BRUSH_SIZE: BrushSizeId = "medium";

/**
 * perfect-freehand settings.
 *
 * These numbers are the difference between "a line" and "paint". `thinning`
 * lets speed and pressure narrow the stroke, which is most of the effect;
 * `streamline` smooths the jitter of a hand or a cheap touchscreen digitiser;
 * the tapers stop both ends in a point rather than a blunt cap.
 *
 * `last` matters: while a stroke is in flight the tail must stay open so it can
 * keep growing, and only on release does the end taper get applied. Passing it
 * wrongly makes the stroke visibly twitch at the moment the user lifts off.
 */
export function strokeOptions(sizePx: number, hasRealPressure: boolean, last: boolean) {
  return {
    size: sizePx,
    thinning: hasRealPressure ? 0.62 : 0.45,
    smoothing: 0.62,
    streamline: 0.42,
    // A stylus reports real pressure; a mouse reports a constant, so width has
    // to come from velocity instead or every mouse stroke is a dead ribbon.
    simulatePressure: !hasRealPressure,
    easing: (p: number) => Math.sin((p * Math.PI) / 2),
    start: { taper: sizePx * 1.4, cap: true },
    end: { taper: sizePx * 2.2, cap: true },
    last,
  };
}

export type PaperRect = { width: number; height: number };

/**
 * Turn normalised stroke points into pixel-space input for perfect-freehand.
 *
 * Each axis scales by its own paper dimension, which is only safe because the
 * paper is always rendered at the aspect ratio the painting was made at — so
 * width and height grow together and the shape never distorts. Brush *width*,
 * by contrast, scales by paper width alone: a radius has one dimension, and
 * deriving it from both would make round dabs elliptical on non-square paper.
 */
function toPixels(points: RawPoint[], paper: PaperRect): number[][] {
  return points.map((p) => [p.x * paper.width, p.y * paper.height, p.pressure]);
}

/**
 * Build the filled outline of a stroke as a Path2D.
 *
 * perfect-freehand returns the polygon that *surrounds* the input points, so
 * this is a fill, not a line — which is exactly why the result reads as a
 * brush loaded with paint rather than a stroked SVG path. Rounding the corners
 * through midpoints removes the faceting that a raw polygon would show at the
 * broad brush sizes.
 */
export function outlinePath(
  points: RawPoint[],
  paper: PaperRect,
  sizeId: BrushSizeId,
  hasRealPressure: boolean,
  last: boolean,
): { path: Path2D; bounds: { x: number; y: number; w: number; h: number } } | null {
  if (points.length === 0) return null;

  const sizePx = brushWidth(sizeId) * paper.width;
  const outline = getStroke(toPixels(points, paper), strokeOptions(sizePx, hasRealPressure, last));
  if (outline.length < 2) return null;

  const path = new Path2D();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);

    if (a[0] < minX) minX = a[0];
    if (a[0] > maxX) maxX = a[0];
    if (a[1] < minY) minY = a[1];
    if (a[1] > maxY) maxY = a[1];
  }
  path.closePath();

  return { path, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

/**
 * A tile of monochrome noise, built once and reused as a fill pattern.
 *
 * Flat colour is the main thing that makes digital paint look digital. Grain
 * multiplied into the stroke breaks the fill up so it reads as pigment sitting
 * on a textured surface. It is generated rather than shipped as an asset, so
 * it costs nothing to download.
 *
 * The tile is drawn twice at different scales — see `drawStroke`. Fine noise
 * alone averages out to flat grey at arm's length, especially on a retina
 * screen where each noise pixel is a quarter of a device pixel; the broad pass
 * is what actually reads as a loaded brush dragging unevenly across paper.
 */
let grainPattern: CanvasPattern | null = null;

export function getGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern) return grainPattern;

  const size = 128;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;

  const image = tctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    // Biased bright: multiplying by a value near white leaves the pigment
    // alone, and the darker tail of the range is what bites into it. Too
    // narrow a range and the texture is invisible; too wide and the stroke
    // looks dirty rather than textured.
    const v = 140 + Math.random() * 115;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tctx.putImageData(image, 0, 0);

  grainPattern = ctx.createPattern(tile, "repeat");
  return grainPattern;
}

/**
 * Darken a hex colour towards black by `amount` (0–1).
 *
 * Used for the rim inside a stroke's edge. Painting the pigment over itself
 * would be a no-op — the edge has to be a genuinely darker colour to read as
 * paint pooling where the brush lifted.
 */
export function shade(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  const k = 1 - amount;
  const r = Math.round(((value >> 16) & 255) * k);
  const g = Math.round(((value >> 8) & 255) * k);
  const b = Math.round((value & 255) * k);
  return `rgb(${r} ${g} ${b})`;
}
