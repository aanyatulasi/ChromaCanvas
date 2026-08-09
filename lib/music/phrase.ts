import type { PaintId } from "../paint/palette.ts";
import type { StrokeFeatures } from "../strokes/features.ts";
import { COLOUR_VOICES, findChord, snapToChordTone, type Chord } from "./chords.ts";
import { CONTOURS, cellsFor, contoursFor, RHYTHM_CELLS } from "./material.ts";
import { makeRng, pick, type Rng } from "./rng.ts";
import { degreeToMidi, midiToNote, type Scale } from "./scales.ts";

/**
 * Turning a stroke into a melody.
 *
 * The rules that keep this musical, in the order they matter:
 *
 *   1. Notes are chosen as scale degrees, so a wrong note cannot be written.
 *   2. Notes landing on strong beats are pulled onto tones of the stroke's
 *      chord. The notes in between are free; the ones the ear leans on always
 *      belong. This is most of what separates a melody from a wander.
 *   3. Leaps are capped, and a leap is answered by a step back the other way.
 *   4. Phrases end on a chord tone, so they sound finished rather than cut off.
 *   5. Later strokes restate and vary the first stroke's shape instead of
 *      inventing unrelated ones, which is what makes a page of separate
 *      strokes add up to one piece.
 *
 * Everything is driven by a seeded generator, so a painting always produces
 * the same music — undo a stroke, restore it, reload next month, identical.
 */

export type Articulation = "legato" | "staccato" | "accent";

export type PhraseNote = {
  midi: number;
  /** Note name for the sampler, e.g. "E4". */
  note: string;
  /** Beats from the start of the phrase. */
  time: number;
  /** Length in beats. */
  duration: number;
  velocity: number;
  articulation: Articulation;
};

export type MotifRole = "seed" | "restate" | "vary" | "contrast";

export type Phrase = {
  notes: PhraseNote[];
  bars: number;
  /** Total length in beats. */
  beats: number;
  chordDegree: number;
  chordQuality: Chord["quality"];
  motifRole: MotifRole;
  /** The shape this phrase was built from, so later phrases can refer back. */
  contourId: string;
  contourSteps: number[];
};

export type PhraseRequest = {
  scale: Scale;
  colorId: PaintId;
  features: StrokeFeatures;
  /** Deterministic per stroke. */
  seed: number;
  /** Position in the painting; drives the restate/vary/contrast pattern. */
  order: number;
  /** The painting's first phrase, if there is one. */
  motif: Phrase | null;
  /** The chord the previous stroke used, so the harmony moves rather than sits. */
  previousDegree: number;
};

const BARS_FOR_LENGTH = { short: 1, medium: 2, long: 3 } as const;
const OCTAVE_FOR_BAND = { low: 3, mid: 4, high: 5 } as const;

/** Beats 1 and 3 of a 4/4 bar — where the ear checks the harmony. */
function isStrongBeat(time: number): boolean {
  const inBar = time % 4;
  return inBar === 0 || inBar === 2;
}

/**
 * Which relationship this phrase has to the painting's opening idea.
 *
 * Fixed by position rather than chosen at random, because a listener needs the
 * opening material to come back on a schedule they can feel. The cycle gives
 * roughly A A' B A'' — statement, variation, contrast, return.
 */
function roleFor(order: number, hasMotif: boolean): MotifRole {
  if (!hasMotif || order === 0) return "seed";
  // A three-step cycle after the opening statement, counted from the stroke
  // *after* the seed. Taking `order % 4` instead lets order 4 fall through to
  // a second restatement and stalls the rotation.
  switch ((order - 1) % 3) {
    case 0:
      return "vary";
    case 1:
      return "contrast";
    default:
      return "restate";
  }
}

/** The four ways a motif is allowed to come back changed. */
function varyMotif(steps: number[], rng: Rng): number[] {
  const transforms = ["invert", "retrograde", "fragment", "stretch"] as const;
  switch (pick(rng, transforms)) {
    case "invert":
      return steps.map((step) => -step);
    case "retrograde":
      return [...steps].reverse();
    case "fragment": {
      const half = steps.slice(0, Math.max(2, Math.ceil(steps.length / 2)));
      return [...half, ...half];
    }
    default:
      // Widen every step by one degree, keeping its direction.
      return steps.map((step) => (step === 0 ? 0 : step + Math.sign(step)));
  }
}

export function generatePhrase(request: PhraseRequest): Phrase {
  const { scale, colorId, features, seed, order, motif, previousDegree } = request;
  const rng = makeRng(seed);
  const voice = COLOUR_VOICES[colorId];
  const size = scale.intervals.length;

  // -- Harmony: the colour picks the quality, the scale picks the chord ------
  const chord = findChord(scale, voice.quality, previousDegree, seed);

  // -- Shape ----------------------------------------------------------------
  const role = roleFor(order, motif !== null);
  let steps: number[];
  let contourId: string;

  if (role === "seed" || role === "contrast" || !motif) {
    const options = contoursFor(features.direction);
    const contour = options.length > 0 ? pick(rng, options) : pick(rng, CONTOURS);
    steps = contour.steps;
    contourId = contour.id;
  } else if (role === "vary") {
    steps = varyMotif(motif.contourSteps, rng);
    contourId = `${motif.contourId}'`;
  } else {
    steps = motif.contourSteps;
    contourId = motif.contourId;
  }

  // -- Rhythm ---------------------------------------------------------------
  const bars = BARS_FOR_LENGTH[features.length];
  const densities =
    features.length === "short"
      ? (["sparse", "even"] as const)
      : features.length === "long"
        ? (["even", "busy"] as const)
        : (["even", "even", "busy"] as const);

  const beatsPattern: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const pool = cellsFor(pick(rng, densities));
    const cell = pool.length > 0 ? pick(rng, pool) : RHYTHM_CELLS[3];
    beatsPattern.push(...cell.beats);
  }

  // -- Register -------------------------------------------------------------
  const octave = Math.min(
    6,
    Math.max(2, OCTAVE_FOR_BAND[features.band] + voice.registerBias),
  );

  // -- Write the line -------------------------------------------------------
  const notes: PhraseNote[] = [];
  let degree = chord.degree;
  let time = 0;
  let previousLeap = 0;

  for (let i = 0; i < beatsPattern.length; i++) {
    const beat = beatsPattern[i];
    const isLast = i === beatsPattern.length - 1;

    if (i > 0) {
      let step = steps[(i - 1) % steps.length];

      // A leap is answered by a step the other way. Two leaps in the same
      // direction is the fastest way to make a line sound arbitrary.
      if (Math.abs(previousLeap) >= 2 && Math.sign(step) === Math.sign(previousLeap)) {
        step = -Math.sign(previousLeap);
      }

      // Nothing wider than a fifth, ever.
      if (Math.abs(step) > 4) step = Math.sign(step) * 4;

      degree += step;
      previousLeap = step;
    }

    // Strong beats and the final note belong to the chord.
    if (isStrongBeat(time) || isLast) {
      const snapped = snapToChordTone(chord, degree, size);
      // Only accept the snap if it does not itself create a leap.
      if (Math.abs(snapped - degree) <= 2) degree = snapped;
    }

    // Keep the line inside a comfortable range around its register rather than
    // climbing away over a long phrase.
    if (degree > chord.degree + size + 2) degree -= size;
    if (degree < chord.degree - size) degree += size;

    const midi = degreeToMidi(scale, degree, octave);
    const strong = isStrongBeat(time);

    let duration = beat * voice.lengthScale;
    if (voice.articulation === "staccato") duration = Math.min(duration, beat * 0.55);
    duration = Math.max(0.12, duration);

    const velocity = clamp(
      voice.velocity + (strong ? 0.12 : 0) + (rng() - 0.5) * 0.1,
      0.15,
      1,
    );

    // An ornament: a quick neighbour note leaning into the main one. Used
    // sparingly, and only where there is room for it.
    if (beat >= 1 && rng() < voice.ornament) {
      const grace = degreeToMidi(scale, degree + 1, octave);
      notes.push({
        midi: grace,
        note: midiToNote(grace),
        time,
        duration: Math.max(0.1, beat * 0.22),
        velocity: velocity * 0.7,
        articulation: "staccato",
      });
      notes.push({
        midi,
        note: midiToNote(midi),
        time: time + beat * 0.25,
        duration: Math.max(0.12, duration - beat * 0.25),
        velocity,
        articulation: voice.articulation,
      });
    } else {
      notes.push({
        midi,
        note: midiToNote(midi),
        time,
        duration,
        velocity,
        articulation: voice.articulation,
      });
    }

    time += beat;
  }

  return {
    notes,
    bars,
    beats: bars * 4,
    chordDegree: chord.degree,
    chordQuality: chord.quality,
    motifRole: role,
    contourId,
    contourSteps: steps,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
