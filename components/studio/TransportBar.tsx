"use client";

import { Pause, Play, Sparkles } from "lucide-react";
import { useCallback } from "react";
import { usePlayback } from "@/lib/audio/usePlayback";
import { playArrangement, stop } from "@/lib/audio/transport";
import { arrangementSeconds } from "@/lib/music/arrange";
import { useArrangement } from "@/lib/music/useArrangement";
import { usePainting } from "@/store/paintingStore";

/**
 * Finish, and play.
 *
 * Two buttons that mean different things. "Finish the piece" is the moment the
 * painting becomes a composition — it assembles the phrases into an
 * arrangement and immediately performs it, because the whole point of the
 * product is that pressing it is a surprise worth having. Play is for every
 * listen after that.
 *
 * The arrangement itself is derived rather than stored: it is a pure function
 * of the strokes, the key and the tempo, so it is rebuilt whenever any of them
 * changes and can never fall out of step with the painting.
 */
export function TransportBar() {
  const strokeCount = usePainting((s) => s.strokes.length);
  const tempo = usePainting((s) => s.tempo);
  const setTempo = usePainting((s) => s.setTempo);
  const { playing, progress } = usePlayback();

  const arrangement = useArrangement();
  const hasPaint = strokeCount > 0;
  const seconds = arrangementSeconds(arrangement);

  const onPlay = useCallback(() => {
    if (playing) stop();
    else void playArrangement(arrangement);
  }, [arrangement, playing]);

  if (!hasPaint) return null;

  return (
    <div className="chrome flex items-center gap-3 rounded-full px-3 py-2">
      <button
        type="button"
        onClick={onPlay}
        aria-label={playing ? "Stop" : "Finish the piece and play it"}
        title={playing ? "Stop" : "Finish the piece and play it"}
        className="flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-shell transition-transform duration-200 ease-soft hover:scale-[1.03]"
      >
        {playing ? <Pause size={16} /> : <Sparkles size={16} />}
        <span className="whitespace-nowrap">{playing ? "Stop" : "Finish the piece"}</span>
      </button>

      <button
        type="button"
        onClick={onPlay}
        disabled={playing}
        aria-label="Play the whole painting"
        title="Play the whole painting"
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-200 ease-soft hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <Play size={18} />
      </button>

      {/* Progress. A plain bar, not a sequencer playhead — the painting is the
          thing performing, and this only says how far through it is. */}
      <div className="hidden min-w-28 flex-1 items-center gap-2 sm:flex">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full bg-brass transition-[width] duration-100 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-faint">
          {formatDuration(seconds)}
        </span>
      </div>

      <label className="hidden items-center gap-2 md:flex">
        <span className="text-xs text-ink-faint">Tempo</span>
        <input
          type="range"
          min={56}
          max={140}
          step={2}
          value={tempo}
          onChange={(event) => setTempo(Number(event.target.value))}
          className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-hairline accent-brass"
          aria-label="Tempo in beats per minute"
        />
        <span className="w-6 text-xs tabular-nums text-ink-faint">{tempo}</span>
      </label>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
