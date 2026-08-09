import type { RawPoint } from "../paint/types.ts";

/**
 * What the music is allowed to know about a stroke.
 *
 * Five coarse buckets, and deliberately nothing more. The temptation is to
 * feed every wiggle of the pointer into the melody, and that is exactly what
 * produces the random, unpleasant music this product exists to avoid. A stroke
 * is a prompt, not a score: it says "rising, high, fairly long" and the phrase
 * writer takes it from there.
 *
 * Note that y runs downwards on a canvas — 0 is the top of the sheet. Painting
 * higher up means a smaller y and a higher pitch, so several comparisons here
 * read backwards on purpose.
 */

export type StrokeDirection = "rise" | "fall" | "arch" | "dip" | "flat";
export type StrokeBand = "low" | "mid" | "high";
export type StrokeLength = "short" | "medium" | "long";

export type StrokeFeatures = {
  direction: StrokeDirection;
  band: StrokeBand;
  length: StrokeLength;
  /** Arc length in sheet widths. Kept raw for the arrangement's use. */
  arcLength: number;
  /** Mean height, 0 at the top of the sheet. */
  meanY: number;
};

export function extractFeatures(points: RawPoint[]): StrokeFeatures {
  if (points.length === 0) {
    return { direction: "flat", band: "mid", length: "short", arcLength: 0, meanY: 0.5 };
  }

  const first = points[0];
  const last = points[points.length - 1];

  let arcLength = 0;
  let sumY = 0;
  for (let i = 0; i < points.length; i++) {
    sumY += points[i].y;
    if (i > 0) {
      arcLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
  }
  const meanY = sumY / points.length;

  // Net travel, sign flipped so that positive means the stroke went upwards on
  // the sheet and therefore upwards in pitch.
  const netRise = first.y - last.y;

  // How far the middle of the stroke bulges away from the straight line
  // between its ends. This is what separates an arch from a plain rise.
  const midpoint = points[Math.floor(points.length / 2)];
  const chordMidY = (first.y + last.y) / 2;
  const bulge = chordMidY - midpoint.y;

  const direction: StrokeDirection =
    Math.abs(bulge) > 0.09 && Math.abs(bulge) > Math.abs(netRise) * 0.75
      ? bulge > 0
        ? "arch"
        : "dip"
      : Math.abs(netRise) < 0.06
        ? "flat"
        : netRise > 0
          ? "rise"
          : "fall";

  const band: StrokeBand = meanY < 0.36 ? "high" : meanY > 0.64 ? "low" : "mid";

  const length: StrokeLength =
    arcLength < 0.25 ? "short" : arcLength < 0.75 ? "medium" : "long";

  return { direction, band, length, arcLength, meanY };
}
