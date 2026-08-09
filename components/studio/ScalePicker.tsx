"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/studio/ConfirmDialog";
import { SCALES, type ScaleId } from "@/lib/music/scales";
import { usePainting } from "@/store/paintingStore";

/**
 * The key the whole painting is heard in.
 *
 * Changing it after there is paint on the sheet rewrites every phrase, so it
 * asks first. The rewrite is exact rather than approximate — generation is
 * deterministic, so switching away and back returns the original piece note
 * for note — but that is not obvious from the outside, and losing a piece you
 * liked to a mis-click would be unforgivable.
 */
export function ScalePicker() {
  const scaleId = usePainting((s) => s.scaleId);
  const setScale = usePainting((s) => s.setScale);
  const hasPaint = usePainting((s) => s.strokes.length > 0);
  const [pending, setPending] = useState<ScaleId | null>(null);

  const current = SCALES.find((s) => s.id === scaleId) ?? SCALES[0];

  const request = (next: ScaleId) => {
    if (next === scaleId) return;
    if (hasPaint) setPending(next);
    else setScale(next);
  };

  const pendingScale = SCALES.find((s) => s.id === pending);

  return (
    <>
      <label className="relative flex shrink-0 items-center">
        <span className="sr-only">Musical mood</span>
        <select
          value={scaleId}
          onChange={(event) => request(event.target.value as ScaleId)}
          className="cursor-pointer appearance-none rounded-full border border-hairline bg-panel py-1.5 pl-3 pr-7 text-xs text-ink-muted outline-none transition-colors hover:text-ink"
        >
          {SCALES.map((scale) => (
            <option key={scale.id} value={scale.id}>
              {scale.mood} · {scale.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-2.5 text-[9px] text-ink-faint"
        >
          ▼
        </span>
      </label>

      <ConfirmDialog
        open={pending !== null}
        title="Change the mood?"
        body={`Every phrase in this painting will be rewritten in ${
          pendingScale?.label ?? "the new key"
        }. Your brushstrokes stay exactly as they are — only the music changes. Switching back restores the original piece.`}
        confirmLabel={`Rewrite in ${pendingScale?.mood ?? "the new mood"}`}
        onConfirm={() => {
          if (pending) setScale(pending);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />

      <span className="sr-only">Current mood: {current.mood}</span>
    </>
  );
}
