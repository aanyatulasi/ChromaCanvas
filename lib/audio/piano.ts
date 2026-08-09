import type * as ToneNS from "tone";

/**
 * The grand piano.
 *
 * One voice, one sample set, no synthesiser tones in the finished experience.
 * Everything here is arranged around three awkward facts about audio on the
 * web:
 *
 *   1. A browser will not make a sound until the user has interacted with the
 *      page, so starting the audio context is a separate step from loading.
 *   2. Loading two megabytes of samples takes time, and painting must not wait
 *      for it — the brush has to work from the first frame.
 *   3. Any of it can fail, and a silent app with no explanation is worse than
 *      an honest one with a lesser sound.
 *
 * Tone is imported dynamically rather than at module scope. Client components
 * still execute on the server during rendering, and Tone reaches for browser
 * globals as it initialises; the dynamic import also keeps a large library out
 * of the initial page bundle.
 */

export type PianoStatus =
  /** Nothing requested yet. */
  | "idle"
  /** Samples are downloading. Painting works; sound does not yet. */
  | "loading"
  /** The sampler is playable. */
  | "ready"
  /** Samples could not be loaded; a stand-in voice is in use. */
  | "fallback";

export type PianoState = {
  status: PianoStatus;
  loaded: number;
  total: number;
  /** True once the audio context is running, which needs a user gesture. */
  unlocked: boolean;
};

/**
 * One sample every minor third from A0 to C8. Tone repitches between them, so
 * 30 files cover all 88 keys; the gaps are small enough that the stretching is
 * inaudible. Filenames substitute "s" for "#" because the sample set does.
 */
const SAMPLE_NOTES = [
  "A0", "C1", "D#1", "F#1", "A1", "C2", "D#2", "F#2", "A2", "C3",
  "D#3", "F#3", "A3", "C4", "D#4", "F#4", "A4", "C5", "D#5", "F#5",
  "A5", "C6", "D#6", "F#6", "A6", "C7", "D#7", "F#7", "A7", "C8",
];

const BASE_URL = "/audio/piano/";

// -- Observable state ---------------------------------------------------------

let state: PianoState = {
  status: "idle",
  loaded: 0,
  total: SAMPLE_NOTES.length,
  unlocked: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<PianoState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): PianoState {
  return state;
}

/** Stable snapshot for server rendering, where no audio exists. */
const SERVER_STATE: PianoState = {
  status: "idle",
  loaded: 0,
  total: SAMPLE_NOTES.length,
  unlocked: false,
};

export function getServerState(): PianoState {
  return SERVER_STATE;
}

// -- Engine -------------------------------------------------------------------

let tone: typeof ToneNS | null = null;
let instrument: ToneNS.Sampler | ToneNS.PolySynth | null = null;
let loading: Promise<void> | null = null;

async function getTone(): Promise<typeof ToneNS> {
  tone ??= await import("tone");
  return tone;
}

/**
 * Download the samples and build the sampler. Safe to call repeatedly; the
 * work happens once. Does not need a user gesture — decoding audio is allowed
 * before the context is running, which is what lets the piano be ready by the
 * time someone finishes their first stroke.
 */
export function loadPiano(): Promise<void> {
  loading ??= load();
  return loading;
}

async function load(): Promise<void> {
  setState({ status: "loading", loaded: 0 });

  try {
    const Tone = await getTone();

    // Each sample is loaded on its own so progress can be reported honestly.
    // A file that fails resolves to null rather than rejecting: the sampler
    // repitches from whatever notes it has, so losing one sample costs a
    // little fidelity in that region instead of the whole instrument.
    const results = await Promise.all(
      SAMPLE_NOTES.map(
        (note) =>
          new Promise<[string, ToneNS.ToneAudioBuffer] | null>((resolve) => {
            const url = `${BASE_URL}${note.replace("#", "s")}.mp3`;
            const buffer: ToneNS.ToneAudioBuffer = new Tone.ToneAudioBuffer(
              url,
              () => {
                setState({ loaded: state.loaded + 1 });
                resolve([note, buffer]);
              },
              () => resolve(null),
            );
          }),
      ),
    );

    const urls = Object.fromEntries(
      results.filter((entry): entry is [string, ToneNS.ToneAudioBuffer] => entry !== null),
    );

    if (Object.keys(urls).length === 0) throw new Error("no piano samples loaded");

    const sampler = new Tone.Sampler({
      urls,
      // A touch of release lets notes ring into each other the way a piano
      // does with the dampers lifting, instead of stopping dead.
      release: 1.4,
    });

    // A small room. A completely dry sampled piano sounds like headphones
    // clamped to the strings; this is the difference between "a recording of
    // a piano" and "a piano in a room".
    try {
      const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 });
      await reverb.ready;
      sampler.connect(reverb);
      reverb.toDestination();
    } catch {
      sampler.toDestination();
    }

    instrument = sampler;
    setState({ status: "ready", loaded: Object.keys(urls).length });
  } catch {
    await buildFallback();
  }
}

/**
 * A stand-in voice for when the samples cannot be had.
 *
 * Explicitly not the shipped experience — the interface says so when this is
 * in use. It exists so that a flaky network degrades the sound rather than
 * removing it, which is the difference between a disappointing app and a
 * broken one.
 */
async function buildFallback(): Promise<void> {
  try {
    const Tone = await getTone();
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.006, decay: 1.6, sustain: 0.04, release: 1.6 },
    }).toDestination();
    synth.volume.value = -10;
    instrument = synth;
    setState({ status: "fallback" });
  } catch {
    instrument = null;
    setState({ status: "fallback" });
  }
}

/**
 * Start the audio context. Must be called from inside a user gesture, or the
 * browser refuses and everything stays silent.
 */
export async function unlockAudio(): Promise<void> {
  if (state.unlocked) return;
  try {
    const Tone = await getTone();
    await Tone.start();
    setState({ unlocked: true });
  } catch {
    /* The next gesture will try again. */
  }
}

export type NoteEvent = {
  note: string;
  /** Seconds from now, or an absolute transport time when scheduling. */
  time?: number;
  duration: number;
  velocity: number;
};

/** Play one note. Silently does nothing if the piano is not playable yet. */
export function playNote({ note, time, duration, velocity }: NoteEvent): void {
  if (!instrument || !state.unlocked) return;
  try {
    instrument.triggerAttackRelease(
      note,
      duration,
      time === undefined ? undefined : `+${Math.max(0, time)}`,
      velocity,
    );
  } catch {
    /* A note that cannot be scheduled is not worth interrupting painting for. */
  }
}

/** Stop everything immediately. */
export function stopAll(): void {
  try {
    instrument?.releaseAll();
  } catch {
    /* nothing playing */
  }
}
