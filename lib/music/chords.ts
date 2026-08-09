import type { PaintId } from "../paint/palette.ts";
import { hashSeed } from "./rng.ts";
import { degreeToMidi, type Scale } from "./scales.ts";

/**
 * Colour is harmony.
 *
 * Each pigment names a chord quality, and that is the loudest thing the
 * painter controls: pick yellow and the phrase sits on a bright major chord,
 * pick pink and it leans on something fragile and unresolved.
 *
 * The complication is that a quality and a scale can disagree. A diminished
 * chord built on C in C major needs an E flat and a G flat, neither of which
 * is in the key, and the promise that every phrase stays in scale is worth
 * more than a literal reading of the colour. So the colour chooses the
 * *quality* and the scale chooses *which chord* supplies it: in C major,
 * "major" is available on I, IV and V, "minor" on ii, iii and vi, and
 * "diminished" only on vii. The painter hears the character they picked, and
 * the music stays in key.
 *
 * When a scale cannot supply a quality at all — the pentatonics have only five
 * degrees and few usable stacks — the closest available chord is used instead
 * of leaving the key.
 */

export type ChordQuality =
  | "major"
  | "minor"
  | "major7"
  | "minor7"
  | "dominant7"
  | "sus4"
  | "diminished";

export type ColourVoice = {
  quality: ChordQuality;
  /** How the pigment plays, once the harmony is settled. */
  articulation: "legato" | "staccato" | "accent";
  /** Register bias in octaves, applied on top of the stroke's own height. */
  registerBias: number;
  /** Multiplies note lengths: below 1 is clipped and light, above 1 is sustained. */
  lengthScale: number;
  /** Base loudness, 0–1. */
  velocity: number;
  /** Chance per note of an added ornament or repeat, 0–1. */
  ornament: number;
};

export const COLOUR_VOICES: Record<PaintId, ColourVoice> = {
  // Gentle, flowing, legato — a soft minor seventh.
  blue: {
    quality: "minor7",
    articulation: "legato",
    registerBias: 0,
    lengthScale: 1.35,
    velocity: 0.5,
    ornament: 0.1,
  },
  // Light and playful — plain major, clipped short.
  yellow: {
    quality: "major",
    articulation: "staccato",
    registerBias: 1,
    lengthScale: 0.62,
    velocity: 0.6,
    ornament: 0.3,
  },
  // Confident and rhythmically strong — a dominant seventh, which leans
  // forward and wants to resolve.
  red: {
    quality: "dominant7",
    articulation: "accent",
    registerBias: 0,
    lengthScale: 0.9,
    velocity: 0.8,
    ornament: 0.2,
  },
  // Calm and lyrical — a major seventh, the most settled chord here.
  green: {
    quality: "major7",
    articulation: "legato",
    registerBias: 0,
    lengthScale: 1.15,
    velocity: 0.55,
    ornament: 0.12,
  },
  // Spacious and reflective — plain minor, low and slow.
  purple: {
    quality: "minor",
    articulation: "legato",
    registerBias: -1,
    lengthScale: 1.5,
    velocity: 0.45,
    ornament: 0.08,
  },
  // Warm and energetic — a suspended fourth, open rather than tense.
  orange: {
    quality: "sus4",
    articulation: "accent",
    registerBias: 0,
    lengthScale: 0.78,
    velocity: 0.7,
    ornament: 0.22,
  },
  // Delicate and bittersweet — the diminished degree, high and quiet.
  pink: {
    quality: "diminished",
    articulation: "staccato",
    registerBias: 1,
    lengthScale: 0.72,
    velocity: 0.42,
    ornament: 0.35,
  },
};

/** Semitone shapes, measured from the root. */
const QUALITY_SHAPES: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  sus4: [0, 5, 7],
  diminished: [0, 3, 6],
};

export type Chord = {
  /** Scale degree of the root. */
  degree: number;
  quality: ChordQuality;
  /** Chord tones as scale degrees relative to the root's degree. */
  toneDegrees: number[];
  /** How closely this matched the requested quality; 0 is exact. */
  distance: number;
};

/**
 * Stack thirds on a degree to get the chord the scale itself provides there.
 *
 * "Thirds" means every other scale degree, which is what makes the result
 * diatonic by construction — it is built out of the scale rather than imposed
 * on it. In a seven-note scale this gives the familiar triads and sevenths; in
 * a pentatonic it gives the wider, more open stacks those scales actually
 * contain, which is correct rather than a compromise.
 */
function chordShapeAt(scale: Scale, degree: number, tones: number): number[] {
  const root = degreeToMidi(scale, degree, 4);
  const shape: number[] = [];
  for (let i = 0; i < tones; i++) {
    shape.push(degreeToMidi(scale, degree + i * 2, 4) - root);
  }
  return shape;
}

/** How far one chord shape is from another, in semitones summed over tones. */
function shapeDistance(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  let total = 0;
  for (let i = 0; i < length; i++) {
    const left = a[i] ?? a[a.length - 1];
    const right = b[i] ?? b[b.length - 1];
    total += Math.abs(left - right);
  }
  // A chord with the wrong number of tones is a worse match than one with the
  // right number, even if the tones it does have line up.
  return total + Math.abs(a.length - b.length) * 2;
}

/**
 * Find the degree of this scale whose own chord best expresses `quality`.
 *
 * `preferDegree` breaks ties, which is how the arrangement later steers
 * consecutive strokes towards a progression that moves rather than one that
 * sits on the same chord.
 */
export function findChord(
  scale: Scale,
  quality: ChordQuality,
  preferDegree = 0,
  salt = 0,
): Chord {
  const wanted = QUALITY_SHAPES[quality];
  const size = scale.intervals.length;

  let best: Chord | null = null;
  for (let degree = 0; degree < size; degree++) {
    const shape = chordShapeAt(scale, degree, wanted.length);
    const distance = shapeDistance(shape, wanted);
    // Push away from the previous chord, so the harmony has somewhere to go.
    const movement = Math.abs(((degree - preferDegree + size) % size) - size / 2) * 0.01;
    // Several degrees usually express a quality equally well — in C major,
    // "minor" is an exact match on ii, iii and vi. Without this, the same
    // pigment would land on the same chord every time it was used. The salt is
    // the stroke's own seed, so the choice varies between strokes and is still
    // identical every time that stroke is regenerated.
    const jitter = ((hashSeed(salt, degree) % 1000) / 1000) * 0.008;
    const score = distance + movement + jitter;

    if (!best || score < best.distance) {
      best = {
        degree,
        quality,
        toneDegrees: Array.from({ length: wanted.length }, (_, i) => i * 2),
        distance: score,
      };
    }
  }

  return best!;
}

/** The chord's tones as scale degrees, absolute rather than relative. */
export function chordTones(chord: Chord): number[] {
  return chord.toneDegrees.map((offset) => chord.degree + offset);
}

/**
 * Nudge a degree onto the nearest chord tone.
 *
 * Applied on strong beats only. It is the mechanism that stops a melody from
 * wandering: the notes in between are free, but the ones that land where the
 * ear is listening hardest always belong to the chord underneath.
 */
export function snapToChordTone(chord: Chord, degree: number, size: number): number {
  const tones = chordTones(chord);
  let best = degree;
  let bestDistance = Infinity;

  // Search neighbouring octaves too, so a melody high above the chord snaps to
  // the tone above it rather than being dragged back down to the root.
  for (let octave = -2; octave <= 2; octave++) {
    for (const tone of tones) {
      const candidate = tone + octave * size;
      const distance = Math.abs(candidate - degree);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }
  return best;
}
