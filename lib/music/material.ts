import type { StrokeDirection } from "../strokes/features.ts";

/**
 * The curated material every phrase is built from.
 *
 * This file is the answer to "why does it sound composed rather than
 * generated". Nothing here is random: these are written-out rhythms and
 * melodic shapes, and the generator's job is to choose among them and fit them
 * to the harmony — not to invent notes from nothing. Randomness picks the
 * ingredients; it never writes the line.
 */

/**
 * Rhythmic cells, in beats, one bar of 4/4 each.
 *
 * Each cell sums to 4. They are grouped by how busy they are so that a short
 * stroke and a long one can draw from different pools without the rhythms
 * losing their family resemblance.
 */
export const RHYTHM_CELLS: { id: string; density: "sparse" | "even" | "busy"; beats: number[] }[] = [
  { id: "held", density: "sparse", beats: [3, 1] },
  { id: "breath", density: "sparse", beats: [2, 2] },
  { id: "long-short-short", density: "sparse", beats: [2, 1, 1] },
  { id: "walk", density: "even", beats: [1, 1, 1, 1] },
  { id: "lilt", density: "even", beats: [1.5, 0.5, 1, 1] },
  { id: "dotted", density: "even", beats: [1.5, 1.5, 1] },
  { id: "answer", density: "even", beats: [1, 1, 2] },
  { id: "run", density: "busy", beats: [0.5, 0.5, 1, 1, 1] },
  { id: "skip", density: "busy", beats: [0.5, 0.5, 0.5, 0.5, 2] },
  { id: "tumble", density: "busy", beats: [1, 0.5, 0.5, 1, 1] },
];

/**
 * Melodic contours, written as steps in scale degrees from one note to the
 * next. A contour is a shape, not a tune: the same shape over a different
 * chord in a different register is a different melody that still belongs to
 * the same piece.
 *
 * Steps are kept small on purpose. Every large interval in this file is
 * followed by a step back the other way, which is the oldest rule in melody
 * writing and the reason these lines sound intentional rather than scattered.
 */
export const CONTOURS: { id: string; family: StrokeDirection; steps: number[] }[] = [
  // Rising.
  { id: "climb", family: "rise", steps: [1, 1, 1, 2, 1] },
  { id: "reach", family: "rise", steps: [2, -1, 2, 1, 1] },
  { id: "lift", family: "rise", steps: [1, 2, -1, 2, 1] },

  // Falling.
  { id: "settle", family: "fall", steps: [-1, -1, -2, -1, -1] },
  { id: "sigh", family: "fall", steps: [-2, 1, -2, -1, -1] },
  { id: "descend", family: "fall", steps: [-1, -2, 1, -2, -1] },

  // Up and back down.
  { id: "arch", family: "arch", steps: [1, 2, 1, -2, -1, -1] },
  { id: "crest", family: "arch", steps: [2, 1, -1, -1, -2] },
  { id: "bloom", family: "arch", steps: [1, 1, 2, -1, -2, -1] },

  // Down and back up.
  { id: "dip", family: "dip", steps: [-1, -2, -1, 2, 1, 1] },
  { id: "scoop", family: "dip", steps: [-2, -1, 1, 1, 2] },
  { id: "hollow", family: "dip", steps: [-1, -1, -1, 2, 2] },

  // Going nowhere, gracefully. Turns and neighbour notes.
  { id: "turn", family: "flat", steps: [1, -1, -1, 1, 0] },
  { id: "pulse", family: "flat", steps: [0, 1, -1, 0, 1] },
  { id: "rock", family: "flat", steps: [2, -2, 1, -1, 0] },
];

export function contoursFor(family: StrokeDirection) {
  return CONTOURS.filter((contour) => contour.family === family);
}

export function cellsFor(density: "sparse" | "even" | "busy") {
  return RHYTHM_CELLS.filter((cell) => cell.density === density);
}
