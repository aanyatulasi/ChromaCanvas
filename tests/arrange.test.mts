import assert from "node:assert/strict";
import { test } from "node:test";

import { arrange, arrangementSeconds } from "../lib/music/arrange.ts";
import { generatePhrase } from "../lib/music/phrase.ts";
import { hashSeed } from "../lib/music/rng.ts";
import { getScale, isInScale, SCALES } from "../lib/music/scales.ts";
import { extractFeatures } from "../lib/strokes/features.ts";
import { PAINT_IDS } from "../lib/paint/palette.ts";
import type { Stroke } from "../lib/paint/types.ts";

/**
 * The arrangement is what turns a set of previews into a piece. These tests
 * cover the things that would make it sound wrong rather than merely differ.
 */

const SEED = 77123;

function buildPainting(count: number, scaleId = "c-major" as const): Stroke[] {
  const scale = getScale(scaleId);
  const shapes = [
    (u: number) => 0.8 - 0.5 * u,
    (u: number) => 0.7 - 0.4 * Math.sin(u * Math.PI),
    (u: number) => 0.2 + 0.5 * u,
    () => 0.5,
  ];

  const strokes: Stroke[] = [];
  for (let order = 0; order < count; order++) {
    const shape = shapes[order % shapes.length];
    const points = Array.from({ length: 40 }, (_, i) => {
      const u = i / 39;
      return { x: 0.1 + 0.8 * u, y: shape(u), pressure: 0.6, t: u * 900 };
    });
    const colorId = PAINT_IDS[order % PAINT_IDS.length];
    const features = extractFeatures(points);
    const phrase = generatePhrase({
      scale,
      colorId,
      features,
      seed: hashSeed(SEED, order, colorId),
      order,
      motif: strokes.length > 0 ? strokes[0].phrase : null,
      previousDegree: strokes.length > 0 ? strokes[strokes.length - 1].phrase.chordDegree : 0,
    });
    strokes.push({
      id: `s${order}`,
      order,
      points,
      colorId,
      sizeId: "medium",
      jitter: 0.5,
      features,
      phraseSeed: hashSeed(SEED, order, colorId),
      phrase,
    });
  }
  return strokes;
}

test("an empty painting produces an empty piece", () => {
  const piece = arrange([], getScale("c-major"), 84);
  assert.equal(piece.notes.length, 0);
  assert.equal(piece.totalBeats, 0);
  assert.equal(arrangementSeconds(piece), 0);
});

test("every note of the finished piece is in key", () => {
  // Including the left hand and the closing cadence, which are written by the
  // arrangement rather than by the phrase writer and so are not covered by
  // the phrase tests.
  for (const scaleDef of SCALES) {
    const piece = arrange(buildPainting(7, scaleDef.id as "c-major"), scaleDef, 84);
    for (const note of piece.notes) {
      assert.ok(
        isInScale(scaleDef, note.midi),
        `${note.note} (${note.hand} hand) is not in ${scaleDef.label}`,
      );
    }
  }
});

test("the piece has both hands", () => {
  const piece = arrange(buildPainting(5), getScale("c-major"), 84);
  const left = piece.notes.filter((n) => n.hand === "left");
  const right = piece.notes.filter((n) => n.hand === "right");
  assert.ok(right.length > 0, "no melody");
  assert.ok(left.length > 0, "no accompaniment");
  // The left hand supports rather than competes.
  assert.ok(left.length < right.length, "the left hand should be sparser than the melody");
});

test("the left hand stays below the melody it is accompanying", () => {
  // Accompaniment written on top of the tune is the fastest way to make a
  // piano piece sound muddy.
  //
  // Compared phrase by phrase rather than across the whole piece: a painting
  // that moves between registers will legitimately have a left hand in one
  // section sitting above the melody of a much lower section elsewhere, and
  // those two never sound at the same time.
  const piece = arrange(buildPainting(6), getScale("c-major"), 84);

  for (const window of piece.windows) {
    const during = (hand: "left" | "right") =>
      piece.notes.filter(
        (n) => n.hand === hand && n.startBeat >= window.startBeat && n.startBeat < window.endBeat,
      );

    const melody = during("right");
    const bass = during("left");
    if (melody.length === 0 || bass.length === 0) continue;

    const lowestMelody = Math.min(...melody.map((n) => n.midi));
    const highestBass = Math.max(...bass.map((n) => n.midi));
    assert.ok(
      highestBass < lowestMelody,
      `during ${window.strokeId} the left hand reaches ${highestBass} but the melody bottoms out at ${lowestMelody}`,
    );
  }
});

test("notes are ordered and the piece runs to the end", () => {
  const piece = arrange(buildPainting(6), getScale("c-major"), 84);
  for (let i = 1; i < piece.notes.length; i++) {
    assert.ok(piece.notes[i].startBeat >= piece.notes[i - 1].startBeat);
  }
  const last = Math.max(...piece.notes.map((n) => n.startBeat));
  assert.ok(last < piece.totalBeats, "a note starts after the piece has ended");
  assert.ok(piece.totalBeats > 0);
});

test("the piece ends on the tonic", () => {
  // Ending on whichever colour happened to be painted last almost never
  // sounds like an ending.
  for (const scaleDef of SCALES) {
    const piece = arrange(buildPainting(5, scaleDef.id as "c-major"), scaleDef, 84);
    assert.equal(
      piece.progression[piece.progression.length - 1],
      0,
      `${scaleDef.label} does not close on the tonic`,
    );

    const finalBeat = Math.max(...piece.notes.map((n) => n.startBeat));
    const finalNotes = piece.notes.filter((n) => n.startBeat === finalBeat);
    const tonicPitchClass = scaleDef.tonic % 12;
    assert.ok(
      finalNotes.some((n) => n.midi % 12 === tonicPitchClass),
      `${scaleDef.label} final chord contains no tonic`,
    );
  }
});

test("every stroke gets a window, in order, and they do not overlap", () => {
  // The illumination depends on these: an overlap would light two strokes at
  // once for phrases that are not actually sounding together.
  const strokes = buildPainting(8);
  const piece = arrange(strokes, getScale("c-major"), 84);

  assert.equal(piece.windows.length, strokes.length);
  strokes.forEach((stroke, i) => assert.equal(piece.windows[i].strokeId, stroke.id));

  for (let i = 1; i < piece.windows.length; i++) {
    assert.ok(
      piece.windows[i].startBeat >= piece.windows[i - 1].endBeat,
      `stroke ${i} starts before stroke ${i - 1} finishes`,
    );
  }
  for (const window of piece.windows) {
    assert.ok(window.endBeat > window.startBeat, "a stroke sounds for no time at all");
  }
});

test("the same painting always arranges to the same piece", () => {
  const strokes = buildPainting(6);
  assert.deepEqual(
    arrange(strokes, getScale("c-major"), 84),
    arrange(strokes, getScale("c-major"), 84),
  );
});

test("the piece breathes and does not run relentlessly", () => {
  // A rest bar after every third phrase.
  const piece = arrange(buildPainting(7), getScale("c-major"), 84);
  const gaps = piece.windows
    .slice(1)
    .map((w, i) => w.startBeat - piece.windows[i].endBeat)
    .filter((gap) => gap > 0);
  assert.ok(gaps.length >= 2, `expected rest bars between phrases, found ${gaps.length}`);
});

test("tempo changes the length but not the notes", () => {
  const strokes = buildPainting(5);
  const slow = arrange(strokes, getScale("c-major"), 60);
  const fast = arrange(strokes, getScale("c-major"), 120);

  assert.deepEqual(
    slow.notes.map((n) => n.note),
    fast.notes.map((n) => n.note),
  );
  assert.ok(arrangementSeconds(slow) > arrangementSeconds(fast));
});
