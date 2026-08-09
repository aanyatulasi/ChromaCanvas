"use client";

import { usePianoState } from "@/lib/audio/usePiano";

/**
 * A quiet report on whether the piano is ready.
 *
 * Deliberately small and in a corner. Loading is not an event worth a modal —
 * painting works throughout, and by the time most people finish their first
 * stroke this has already gone. It only becomes prominent when something is
 * actually wrong, because silence with no explanation is the one failure that
 * makes the product look broken.
 */
export function AudioStatus() {
  const { status, loaded, total } = usePianoState();

  if (status === "ready" || status === "idle") return null;

  if (status === "fallback") {
    return (
      <div className="chrome flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-muted">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-paint-orange" />
        <span>
          Piano samples unavailable — using a stand-in voice
        </span>
      </div>
    );
  }

  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div
      className="chrome flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass"
      />
      <span className="tabular-nums">Warming the piano… {percent}%</span>
    </div>
  );
}
