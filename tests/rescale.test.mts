import assert from "node:assert/strict";
import { test } from "node:test";

import { generatePhrase, type Phrase } from "../lib/music/phrase.ts";
import { hashSeed } from "../lib/music/rng.ts";
import { getScale, isInScale, SCALES, type ScaleId } from "../lib/music/scales.ts";
import { extractFeatures, type StrokeFeatures } from "../lib/strokes/features.ts";
import { PAINT_IDS, type PaintId } from "../lib/paint/palette.ts";

/**
 * Changing the key rewrites every phrase rather than transposing the notes,
 * because transposing would drag them outside the new scale.
 *
 * The interface tells the painter that switching back restores the original
 * piece. These tests are what makes that claim true rather than hopeful — the
 * rewrite has to be a pure function of the strokes, the key and the seed.
 */

type SavedStroke = { colorId: PaintId; features: StrokeFeatures; order: number };

function makeStroke(order: number, shape: (u: number) => number): SavedStroke {
  const points = Array.from({ length: 40 }, (_, i) => {
    const u = i / 39;
    return { x: 0.1 + 0.8 * u, y: shape(u), pressure: 0.6, t: u * 900 };
  });
  return {
    colorId: PAINT_IDS[order % PAINT_IDS.length],
    features: extractFeatures(points),
    order,
  };
}

const PAINTING: SavedStroke[] = [
  makeStroke(0, (u) => 0.8 - 0.5 * u),
  makeStroke(1, (u) => 0.7 - 0.4 * Math.sin(u * Math.PI)),
  makeStroke(2, (u) => 0.2 + 0.5 * u),
  makeStroke(3, () => 0.5),
  makeStroke(4, (u) => 0.3 + 0.4 * Math.sin(u * Math.PI)),
];

const SEED = 20260809;

/** Mirrors what the store does when the key changes. */
function renderIn(scaleId: ScaleId): Phrase[] {
  const scale = getScale(scaleId);
  const out: Phrase[] = [];
  for (const stroke of PAINTING) {
    out.push(
      generatePhrase({
        scale,
        colorId: stroke.colorId,
        features: stroke.features,
        seed: hashSeed(SEED, stroke.order, stroke.colorId),
        order: stroke.order,
        motif: out.length > 0 ? out[0] : null,
        previousDegree: out.length > 0 ? out[out.length - 1].chordDegree : 0,
      }),
    );
  }
  return out;
}

test("switching key and back restores the piece note for note", () => {
  const original = renderIn("c-major");
  for (const scaleDef of SCALES) {
    renderIn(scaleDef.id); // wander off through every other key
  }
  assert.deepEqual(renderIn("c-major"), original);
});

test("a rewritten painting is fully inside its new key", () => {
  for (const scaleDef of SCALES) {
    for (const phrase of renderIn(scaleDef.id)) {
      for (const note of phrase.notes) {
        assert.ok(
          isInScale(scaleDef, note.midi),
          `${note.note} is not in ${scaleDef.label} after rewriting`,
        );
      }
    }
  }
});

test("changing key actually changes the music", () => {
  // A rewrite that produced the same notes would make the control pointless.
  const bright = renderIn("c-major").flatMap((p) => p.notes.map((n) => n.note));
  const reflective = renderIn("a-minor").flatMap((p) => p.notes.map((n) => n.note));
  assert.notDeepEqual(bright, reflective);
});

test("the opening motif still governs the rewritten piece", () => {
  for (const scaleDef of SCALES) {
    const phrases = renderIn(scaleDef.id);
    assert.equal(phrases[0].motifRole, "seed");
    // The restatement at order 3 reuses the opening shape in the new key.
    assert.deepEqual(phrases[3].contourSteps, phrases[0].contourSteps);
  }
});
