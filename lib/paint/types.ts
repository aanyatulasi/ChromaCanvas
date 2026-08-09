import type { Phrase } from "../music/phrase.ts";
import type { StrokeFeatures } from "../strokes/features.ts";
import type { PaintId } from "./palette.ts";

/**
 * A raw sample from the pointer.
 *
 * `x` and `y` are normalised 0–1 against the paper rectangle, never pixels.
 * That is the single decision that makes a painting survive a window resize, a
 * reload, a rotation, and being opened on a different device: the stroke is
 * stored as a shape on a sheet of paper, not as a position on a screen.
 *
 * `t` is milliseconds since the stroke began. Nothing in Milestone 1 reads it,
 * but the music engine will use it to tell a fast confident sweep from a slow
 * deliberate one, and it cannot be recovered later.
 */
export type RawPoint = {
  x: number;
  y: number;
  pressure: number;
  t: number;
};

export type BrushSizeId = "fine" | "small" | "medium" | "large" | "broad";

/**
 * A completed brushstroke — the primary creative object in ChromaCanvas.
 *
 * The stroke carries its own music. Storing the generated phrase on the stroke
 * rather than deriving it on demand is what makes undo and redo restore the
 * same melody, and what lets a saved painting be reopened and sound identical.
 */
export type Stroke = {
  id: string;
  /** Position in the painting's creation order; also the phrase's index. */
  order: number;
  points: RawPoint[];
  colorId: PaintId;
  sizeId: BrushSizeId;
  /**
   * Per-stroke variation, 0–1, derived from the stroke's own seed. Nudges
   * opacity and grain so two strokes of the same pigment never look stamped
   * from the same die.
   */
  jitter: number;
  /** The handful of coarse qualities the music is allowed to read. */
  features: StrokeFeatures;
  /** Derived from the painting seed and this stroke's order. */
  phraseSeed: number;
  phrase: Phrase;
};

/** The aspect ratios a sheet of paper is allowed to take. */
export const MIN_ASPECT = 0.62;
export const MAX_ASPECT = 1.9;
export const DEFAULT_ASPECT = 3 / 2;

/**
 * A painting keeps the aspect ratio it was created at. A phone makes a portrait
 * sheet, a laptop makes a landscape one, and either opens correctly anywhere
 * else — centred, letterboxed, never stretched. Paintings have an orientation
 * for the same reason physical ones do.
 */
export function clampAspect(aspect: number): number {
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
}
