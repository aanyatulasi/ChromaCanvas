/**
 * Scales.
 *
 * A scale is a closed set of pitches. Every note ChromaCanvas plays is chosen
 * by scale degree and only converted to a real pitch at the last moment, which
 * means a wrong note is not merely unlikely but unrepresentable. That single
 * decision does more for the musical result than any amount of clever melody
 * writing on top of it.
 */

export type ScaleId =
  | "c-major"
  | "a-minor"
  | "c-major-pentatonic"
  | "a-minor-pentatonic"
  | "d-dorian";

export type Scale = {
  id: ScaleId;
  label: string;
  mood: string;
  /** Pitch class of the tonic, 0 = C. */
  tonic: number;
  /** Semitones above the tonic, ascending, one per degree. */
  intervals: number[];
};

export const SCALES: Scale[] = [
  {
    id: "c-major",
    label: "C major",
    mood: "Bright",
    tonic: 0,
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    id: "a-minor",
    label: "A minor",
    mood: "Reflective",
    tonic: 9,
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: "c-major-pentatonic",
    label: "C major pentatonic",
    mood: "Peaceful",
    tonic: 0,
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: "a-minor-pentatonic",
    label: "A minor pentatonic",
    mood: "Cinematic",
    tonic: 9,
    intervals: [0, 3, 5, 7, 10],
  },
  {
    id: "d-dorian",
    label: "D Dorian",
    mood: "Dreamlike",
    tonic: 2,
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
];

const BY_ID = new Map(SCALES.map((s) => [s.id, s]));

export function getScale(id: ScaleId): Scale {
  return BY_ID.get(id) ?? SCALES[0];
}

export const DEFAULT_SCALE: ScaleId = "c-major";

/**
 * Convert a scale degree to a MIDI note.
 *
 * Degrees are unbounded in both directions: degree 7 of a seven-note scale is
 * the tonic an octave up, degree -1 is the leading note below. Melodies can
 * therefore be written as arithmetic on degrees and cross octaves without
 * anyone having to think about where the scale wraps.
 */
export function degreeToMidi(scale: Scale, degree: number, octave: number): number {
  const size = scale.intervals.length;
  const wrapped = ((degree % size) + size) % size;
  const octaveShift = Math.floor(degree / size);
  return 12 * (octave + 1) + scale.tonic + scale.intervals[wrapped] + 12 * octaveShift;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** MIDI number to a name Tone understands, e.g. 60 -> "C4". */
export function midiToNote(midi: number): string {
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

/** True if a MIDI note belongs to the scale. Used by the tests as a guard. */
export function isInScale(scale: Scale, midi: number): boolean {
  const pitchClass = ((Math.round(midi) - scale.tonic) % 12 + 12) % 12;
  return scale.intervals.includes(pitchClass);
}
