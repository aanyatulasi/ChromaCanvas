import type { Arrangement } from "@/lib/music/arrange";
import { getToneSync, loadPiano, playNoteAt, stopAll, unlockAudio } from "./piano";

/**
 * Playing the finished piece.
 *
 * Notes are scheduled once, up front, against Tone's transport clock — the
 * only clock in the browser that does not drift — and then left alone.
 *
 * The illumination is *not* scheduled. It reads the transport's position every
 * animation frame and works out which strokes are sounding from the
 * arrangement it already has. Scheduling visual callbacks was the obvious
 * approach and the wrong one: it made the highlight depend on a second timing
 * mechanism that can stall independently of the audio, so the painting could
 * carry on glowing over silence or stay dark through a phrase. Asking the
 * clock is both simpler and impossible to get out of step.
 */

export type PlaybackState = {
  playing: boolean;
  /** 0–1 through the piece. */
  progress: number;
};

const IDLE: PlaybackState = { playing: false, progress: 0 };

let state: PlaybackState = IDLE;
const listeners = new Set<() => void>();

function setState(patch: Partial<PlaybackState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribePlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlaybackState(): PlaybackState {
  return state;
}

export function getPlaybackServerState(): PlaybackState {
  return IDLE;
}

let progressTimer: number | null = null;
let secondsPerBeat = 60 / 84;

/**
 * Where the piece has got to, in beats.
 *
 * Read every frame by the canvas. Returns 0 when nothing is playing, which
 * lights nothing.
 */
export function getTransportBeat(): number {
  if (!state.playing) return 0;
  const Tone = getToneSync();
  if (!Tone) return 0;
  return Tone.getTransport().seconds / secondsPerBeat;
}

/** Play an arrangement from the top. */
export async function playArrangement(arrangement: Arrangement): Promise<void> {
  await unlockAudio();
  await loadPiano();

  const Tone = getToneSync();
  if (!Tone || arrangement.notes.length === 0) return;

  stop();

  secondsPerBeat = 60 / arrangement.tempo;
  const totalSeconds = arrangement.totalBeats * secondsPerBeat;

  const transport = Tone.getTransport();
  transport.bpm.value = arrangement.tempo;

  for (const note of arrangement.notes) {
    let duration = note.duration * secondsPerBeat;
    if (note.articulation === "staccato") duration *= 0.72;
    else if (note.articulation === "legato") duration *= 1.08;

    const velocity =
      note.articulation === "accent" ? Math.min(1, note.velocity * 1.12) : note.velocity;

    transport.schedule((time) => {
      playNoteAt(note.note, time, Math.max(0.05, duration), velocity);
    }, note.startBeat * secondsPerBeat);
  }

  // Let the last chord ring before clearing the stage.
  transport.schedule(() => stop(), totalSeconds + 2);

  transport.start();
  setState({ playing: true, progress: 0 });

  progressTimer = window.setInterval(() => {
    const current = Tone.getTransport().seconds;
    setState({ progress: totalSeconds > 0 ? Math.min(1, current / totalSeconds) : 0 });
  }, 60);
}

/**
 * Stop playback and silence everything.
 *
 * Synchronous on purpose: it is wired to a button and to component teardown,
 * and a stop that has to await anything is a stop that keeps playing for a
 * moment after you press it. `getToneSync` returns the already-loaded module,
 * or null if playback never started — in which case there is nothing to stop.
 */
export function stop(): void {
  const Tone = getToneSync();
  if (Tone) {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;
  }
  stopAll();

  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  setState({ playing: false, progress: 0 });
}
