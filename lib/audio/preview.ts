import type { Phrase } from "@/lib/music/phrase";
import { playNote } from "./piano";

/**
 * Play a single phrase, immediately, as the preview for a completed stroke.
 *
 * Scheduled straight against the audio clock rather than through the transport:
 * a preview is a one-off reply to a gesture, and it must not disturb or be
 * disturbed by the arrangement's own playback.
 *
 * Articulation is applied here rather than in the phrase writer, so that the
 * same phrase can be performed differently in a preview and in the finished
 * piece without the notes themselves changing.
 */
export function previewPhrase(phrase: Phrase, tempo: number): void {
  const secondsPerBeat = 60 / tempo;

  for (const note of phrase.notes) {
    const duration = note.duration * secondsPerBeat;
    playNote({
      note: note.note,
      time: note.time * secondsPerBeat,
      // Legato notes overlap slightly into the next, which is what stops a
      // flowing line sounding like a row of separate events.
      duration:
        note.articulation === "legato"
          ? duration * 1.08
          : note.articulation === "staccato"
            ? duration * 0.72
            : duration,
      velocity: note.articulation === "accent" ? Math.min(1, note.velocity * 1.12) : note.velocity,
    });
  }
}
