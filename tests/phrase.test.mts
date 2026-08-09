import assert from "node:assert/strict";
import { test } from "node:test";

import { COLOUR_VOICES } from "../lib/music/chords.ts";
import { generatePhrase, type Phrase } from "../lib/music/phrase.ts";
import { hashSeed } from "../lib/music/rng.ts";
import { getScale, isInScale, SCALES } from "../lib/music/scales.ts";
import { extractFeatures } from "../lib/strokes/features.ts";
import { PAINT_IDS } from "../lib/paint/palette.ts";
import type { RawPoint } from "../lib/paint/types.ts";
import type { StrokeFeatures } from "../lib/strokes/features.ts";

/**
 * These tests guard the promises the product makes about its music. They are
 * not about code coverage — each one corresponds to something a listener would
 * notice immediately if it broke.
 */

/** A synthetic stroke: `shape` maps 0–1 along the stroke to a height. */
function stroke(shape: (u: number) => number, count = 40): RawPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const u = i / (count - 1);
    return { x: 0.1 + 0.8 * u, y: shape(u), pressure: 0.6, t: u * 900 };
  });
}

function phraseFor(
  features: StrokeFeatures,
  options: Partial<Parameters<typeof generatePhrase>[0]> = {},
): Phrase {
  return generatePhrase({
    scale: getScale("c-major"),
    colorId: "blue",
    features,
    seed: 12345,
    order: 0,
    motif: null,
    previousDegree: 0,
    ...options,
  });
}

const rising = extractFeatures(stroke((u) => 0.8 - 0.5 * u));

test("every note of every phrase is in the chosen scale", () => {
  // The whole point of choosing notes as scale degrees is that a wrong note
  // cannot be represented. This checks it across every scale, every pigment
  // and a spread of stroke shapes.
  const shapes = [
    stroke((u) => 0.8 - 0.5 * u), // rising
    stroke((u) => 0.2 + 0.5 * u), // falling
    stroke((u) => 0.7 - 0.4 * Math.sin(u * Math.PI)), // arch
    stroke((u) => 0.3 + 0.4 * Math.sin(u * Math.PI)), // dip
    stroke(() => 0.5), // flat
  ];

  for (const scaleDef of SCALES) {
    for (const colorId of PAINT_IDS) {
      for (const [index, points] of shapes.entries()) {
        const phrase = generatePhrase({
          scale: scaleDef,
          colorId,
          features: extractFeatures(points),
          seed: hashSeed(scaleDef.id, colorId, index),
          order: index,
          motif: null,
          previousDegree: 0,
        });

        assert.ok(phrase.notes.length > 0, `${scaleDef.id}/${colorId} produced no notes`);
        for (const note of phrase.notes) {
          assert.ok(
            isInScale(scaleDef, note.midi),
            `${note.note} (midi ${note.midi}) is not in ${scaleDef.label}`,
          );
        }
      }
    }
  }
});

test("the same painting always produces the same music", () => {
  // Undo a stroke, restore it, reload the page a month later: identical.
  const a = phraseFor(rising, { seed: 999, colorId: "red" });
  const b = phraseFor(rising, { seed: 999, colorId: "red" });
  assert.deepEqual(a, b);
});

test("different strokes produce different melodies", () => {
  // Distinctness is the whole reason a painting is worth listening to.
  const seen = new Set<string>();
  for (let order = 0; order < 12; order++) {
    const phrase = phraseFor(rising, {
      seed: hashSeed("painting", order),
      order,
      colorId: PAINT_IDS[order % PAINT_IDS.length],
    });
    seen.add(phrase.notes.map((n) => `${n.note}@${n.time}`).join("|"));
  }
  assert.ok(seen.size >= 10, `expected mostly distinct phrases, got ${seen.size}/12`);
});

test("melodies move by steps, never by wild leaps", () => {
  // A fifth is the widest interval allowed, and it has to be answered.
  for (const colorId of PAINT_IDS) {
    for (let order = 0; order < 8; order++) {
      const phrase = phraseFor(rising, { seed: hashSeed(colorId, order), order, colorId });
      const pitches = phrase.notes.map((n) => n.midi);
      for (let i = 1; i < pitches.length; i++) {
        const leap = Math.abs(pitches[i] - pitches[i - 1]);
        assert.ok(
          leap <= 12,
          `${colorId} order ${order}: leapt ${leap} semitones (${phrase.notes[i - 1].note} to ${phrase.notes[i].note})`,
        );
      }
    }
  }
});

test("each colour keeps its own harmonic character", () => {
  // Colour is the loudest control the painter has; two pigments must not
  // quietly collapse onto the same chord quality.
  const qualities = new Set(PAINT_IDS.map((id) => COLOUR_VOICES[id].quality));
  assert.equal(qualities.size, PAINT_IDS.length, "two pigments share a chord quality");

  for (const colorId of PAINT_IDS) {
    const phrase = phraseFor(rising, { colorId });
    assert.equal(phrase.chordQuality, COLOUR_VOICES[colorId].quality);
  }
});

test("phrases end on a tone of their own chord", () => {
  // A phrase that stops on a passing note sounds cut off rather than finished.
  for (const scaleDef of SCALES) {
    for (const colorId of PAINT_IDS) {
      const phrase = generatePhrase({
        scale: scaleDef,
        colorId,
        features: rising,
        seed: hashSeed(scaleDef.id, colorId),
        order: 0,
        motif: null,
        previousDegree: 0,
      });
      const last = phrase.notes[phrase.notes.length - 1];
      assert.ok(isInScale(scaleDef, last.midi), `${last.note} ends outside ${scaleDef.label}`);
    }
  }
});

test("later strokes refer back to the painting's opening idea", () => {
  // Statement, variation, contrast, return — so a page of strokes adds up to
  // one piece rather than a playlist.
  const motif = phraseFor(rising, { order: 0 });
  assert.equal(motif.motifRole, "seed");

  const roles = [1, 2, 3, 4, 5].map(
    (order) => phraseFor(rising, { order, motif, seed: hashSeed("x", order) }).motifRole,
  );
  assert.deepEqual(roles, ["vary", "contrast", "restate", "vary", "contrast"]);

  // A restatement reuses the opening shape rather than inventing a new one.
  const restated = phraseFor(rising, { order: 3, motif, seed: hashSeed("x", 3) });
  assert.deepEqual(restated.contourSteps, motif.contourSteps);
});

test("timing is well formed", () => {
  for (const colorId of PAINT_IDS) {
    const phrase = phraseFor(rising, { colorId });
    let previous = -1;
    for (const note of phrase.notes) {
      assert.ok(note.time >= previous, "notes must be in time order");
      assert.ok(note.duration > 0, "every note must have a positive length");
      assert.ok(note.velocity > 0 && note.velocity <= 1, "velocity must be within 0–1");
      previous = note.time;
    }
    assert.ok(phrase.beats > 0);
  }
});

test("stroke shape is read as the right musical gesture", () => {
  assert.equal(extractFeatures(stroke((u) => 0.8 - 0.6 * u)).direction, "rise");
  assert.equal(extractFeatures(stroke((u) => 0.2 + 0.6 * u)).direction, "fall");
  assert.equal(extractFeatures(stroke((u) => 0.75 - 0.45 * Math.sin(u * Math.PI))).direction, "arch");
  assert.equal(extractFeatures(stroke((u) => 0.25 + 0.45 * Math.sin(u * Math.PI))).direction, "dip");
  assert.equal(extractFeatures(stroke(() => 0.5)).direction, "flat");

  // Height on the sheet becomes register: the top of the paper is the top of
  // the keyboard.
  assert.equal(extractFeatures(stroke(() => 0.15)).band, "high");
  assert.equal(extractFeatures(stroke(() => 0.85)).band, "low");
});
