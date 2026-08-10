import type { Stroke } from "../paint/types.ts";
import type { PhraseNote } from "./phrase.ts";
import { degreeToMidi, midiToNote, type Scale } from "./scales.ts";

/**
 * Assembling the finished piece.
 *
 * Playing the stroke previews back to back would be a playlist, not a
 * composition. Four things turn one into the other:
 *
 *   1. A harmony that the whole texture agrees on. The painter has already
 *      written the progression by choosing colours — each stroke's phrase was
 *      composed against the chord its pigment names — so the left hand plays
 *      *that* chord rather than one imposed from outside. Nothing can clash,
 *      because there is only ever one chord sounding.
 *   2. A left hand. Two or three quiet notes a bar under the melody is most of
 *      what makes separate phrases read as one instrument being played.
 *   3. Shape over time: phrases land on bar lines, the occasional bar of rest
 *      lets the piece breathe, and the loudness rises through the middle and
 *      eases off at the end.
 *   4. An ending. The piece closes on a dominant leaning into a held tonic,
 *      which is what makes it sound finished rather than merely stopped.
 *
 * The whole function is deterministic: same painting, same piece, always.
 */

const BEATS_PER_BAR = 4;

export type ArrangedNote = PhraseNote & {
  /** Beats from the start of the piece. */
  startBeat: number;
  hand: "right" | "left";
};

export type StrokeWindow = {
  strokeId: string;
  startBeat: number;
  endBeat: number;
};

export type Arrangement = {
  tempo: number;
  totalBeats: number;
  notes: ArrangedNote[];
  /** When each stroke is sounding, for the playback illumination. */
  windows: StrokeWindow[];
  /** Chord degree per bar, for reference and for the tests. */
  progression: number[];
};

/** Loudness over the piece: quiet opening, a swell through the middle, a soft close. */
function dynamicArc(position: number): number {
  return 0.82 + 0.26 * Math.sin(Math.PI * Math.min(1, Math.max(0, position)));
}

/**
 * The left hand for one bar.
 *
 * Deliberately thin. The temptation is to fill the bar, and a filled bar turns
 * a piano piece into an accompaniment pattern with a tune on top. Two notes
 * placed where the harmony changes do more work than eight.
 */
function leftHandBar(
  scale: Scale,
  chordDegrees: number[],
  octave: number,
  startBeat: number,
  velocity: number,
  busy: boolean,
  /** The left hand must stay below this, or it competes with the melody. */
  ceilingMidi: number,
  /** Which bar of the phrase this is, so consecutive bars are not identical. */
  barInPhrase: number,
): ArrangedNote[] {
  const [root, third, fifth] = chordDegrees;

  const plan: { degree: number; offset: number; duration: number; level: number }[] = busy
    ? // Under a busy phrase the left hand gets out of the way entirely and
      // holds a single root for the bar.
      [{ degree: root, offset: 0, duration: BEATS_PER_BAR * 0.95, level: velocity * 0.9 }]
    : barInPhrase % 2 === 0
      ? [
          { degree: root, offset: 0, duration: 2.4, level: velocity },
          { degree: fifth ?? root + 4, offset: 2, duration: 1.9, level: velocity * 0.82 },
          ...(third === undefined
            ? []
            : [{ degree: third, offset: 3, duration: 0.9, level: velocity * 0.6 }]),
        ]
      : // The alternate bar is sparser and holds longer. The root stays on the
        // downbeat either way — moving it would weaken the harmony rather than
        // vary it — so the difference is carried by what happens above it.
        [
          { degree: root, offset: 0, duration: 3.4, level: velocity * 0.94 },
          {
            degree: third ?? fifth ?? root + 4,
            offset: 2.5,
            duration: 1.4,
            level: velocity * 0.66,
          },
        ];

  let midis = plan.map((entry) => degreeToMidi(scale, entry.degree, octave));

  // Drop the whole voicing by octaves until it sits clear of the melody, then
  // lift it if that has pushed it into the growl at the bottom of the
  // keyboard. Transposing the bar as a unit keeps the chord's shape intact —
  // moving one note would change the harmony rather than its register.
  for (let guard = 0; guard < 4 && Math.max(...midis) > ceilingMidi; guard++) {
    midis = midis.map((midi) => midi - 12);
  }
  for (let guard = 0; guard < 4 && Math.min(...midis) < 28; guard++) {
    midis = midis.map((midi) => midi + 12);
  }

  return plan.map((entry, index) => ({
    midi: midis[index],
    note: midiToNote(midis[index]),
    time: entry.offset,
    startBeat: startBeat + entry.offset,
    duration: entry.duration,
    velocity: Math.min(1, Math.max(0.12, entry.level)),
    articulation: "legato" as const,
    hand: "left" as const,
  }));
}

/**
 * Keep the piece in one register rather than jumping octaves between phrases.
 * A phrase whose first note is more than an octave from where the last one
 * left off is shifted to meet it.
 */
function octaveShiftFor(previousMidi: number | null, firstMidi: number): number {
  if (previousMidi === null) return 0;
  let shift = 0;
  let gap = firstMidi - previousMidi;
  while (gap > 12) {
    shift -= 12;
    gap -= 12;
  }
  while (gap < -12) {
    shift += 12;
    gap += 12;
  }
  return shift;
}

export function arrange(strokes: Stroke[], scale: Scale, tempo: number): Arrangement {
  const notes: ArrangedNote[] = [];
  const windows: StrokeWindow[] = [];
  const progression: number[] = [];

  if (strokes.length === 0) {
    return { tempo, totalBeats: 0, notes, windows, progression };
  }

  // Total bars, needed up front so the loudness arc knows where the middle is.
  let plannedBars = 0;
  strokes.forEach((stroke, index) => {
    plannedBars += stroke.phrase.bars;
    if (index % 3 === 2 && index !== strokes.length - 1) plannedBars += 1;
  });
  const totalBarsWithEnding = plannedBars + 2;

  let bar = 0;
  let previousLastMidi: number | null = null;

  strokes.forEach((stroke, index) => {
    const phrase = stroke.phrase;
    const startBeat = bar * BEATS_PER_BAR;
    const level = dynamicArc(bar / totalBarsWithEnding);

    const shift = octaveShiftFor(previousLastMidi, phrase.notes[0]?.midi ?? 60);

    for (const note of phrase.notes) {
      const midi = note.midi + shift;
      notes.push({
        ...note,
        midi,
        note: midiToNote(midi),
        startBeat: startBeat + note.time,
        velocity: Math.min(1, note.velocity * level),
        hand: "right",
      });
    }

    const melodyLow = Math.min(...phrase.notes.map((n) => n.midi)) + shift;
    // Sit the left hand clear of the melody, and never so low it turns to mud.
    const leftOctave = Math.max(1, Math.min(3, Math.floor(melodyLow / 12) - 2));
    const busy = phrase.notes.length > phrase.bars * 5;

    for (let b = 0; b < phrase.bars; b++) {
      progression.push(phrase.chordDegree);
      notes.push(
        ...leftHandBar(
          scale,
          phrase.chordToneDegrees,
          leftOctave,
          (bar + b) * BEATS_PER_BAR,
          0.34 * level,
          busy,
          melodyLow - 2,
          b,
        ),
      );
    }

    windows.push({
      strokeId: stroke.id,
      startBeat,
      endBeat: startBeat + phrase.bars * BEATS_PER_BAR,
    });

    previousLastMidi = phrase.notes[phrase.notes.length - 1].midi + shift;
    bar += phrase.bars;

    // A bar of air every third phrase, so the piece is not relentless.
    if (index % 3 === 2 && index !== strokes.length - 1) {
      progression.push(phrase.chordDegree);
      bar += 1;
    }
  });

  // -- The ending -----------------------------------------------------------
  // A dominant leaning into a held tonic. Without this the piece stops on
  // whichever colour happened to be painted last, which almost never sounds
  // like an ending.
  const size = scale.intervals.length;
  const dominantDegree = size >= 7 ? 4 : Math.min(3, size - 1);

  const cadenceOctave = previousLastMidi
    ? Math.max(1, Math.min(3, Math.floor(previousLastMidi / 12) - 2))
    : 2;

  const dominantBeat = bar * BEATS_PER_BAR;
  progression.push(dominantDegree);
  notes.push(
    ...leftHandBar(
      scale,
      [dominantDegree, dominantDegree + 2, dominantDegree + 4],
      cadenceOctave,
      dominantBeat,
      0.32,
      false,
      (previousLastMidi ?? 60) - 2,
      0,
    ),
  );

  // A short melodic descent onto the dominant, so the right hand arrives at
  // the ending rather than simply falling silent before it.
  const melodyOctave = previousLastMidi ? Math.floor(previousLastMidi / 12) - 1 : 4;
  [
    { degree: dominantDegree + 2, offset: 0, duration: 1 },
    { degree: dominantDegree + 1, offset: 1, duration: 1 },
    { degree: dominantDegree, offset: 2, duration: 2 },
  ].forEach(({ degree, offset, duration }) => {
    const midi = degreeToMidi(scale, degree, melodyOctave);
    notes.push({
      midi,
      note: midiToNote(midi),
      time: offset,
      startBeat: dominantBeat + offset,
      duration,
      velocity: 0.46,
      articulation: "legato",
      hand: "right",
    });
  });

  bar += 1;
  const finalBeat = bar * BEATS_PER_BAR;
  progression.push(0);

  // The last chord: tonic, both hands, held and quiet.
  for (const degree of [0, 2, 4]) {
    const midi = degreeToMidi(scale, degree, cadenceOctave);
    notes.push({
      midi,
      note: midiToNote(midi),
      time: 0,
      startBeat: finalBeat,
      duration: BEATS_PER_BAR * 1.6,
      velocity: 0.36,
      articulation: "legato",
      hand: "left",
    });
  }
  const tonicTop = degreeToMidi(scale, 7, melodyOctave);
  notes.push({
    midi: tonicTop,
    note: midiToNote(tonicTop),
    time: 0,
    startBeat: finalBeat,
    duration: BEATS_PER_BAR * 1.6,
    velocity: 0.42,
    articulation: "legato",
    hand: "right",
  });

  bar += 1;

  notes.sort((a, b) => a.startBeat - b.startBeat);

  return {
    tempo,
    totalBeats: bar * BEATS_PER_BAR,
    notes,
    windows,
    progression,
  };
}

/** How long the piece runs, in seconds. */
export function arrangementSeconds(arrangement: Arrangement): number {
  return (arrangement.totalBeats * 60) / arrangement.tempo;
}
