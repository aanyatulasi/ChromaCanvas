"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PaintSurface } from "@/components/canvas/PaintSurface";
import { AudioStatus } from "@/components/studio/AudioStatus";
import { ConfirmDialog } from "@/components/studio/ConfirmDialog";
import { PaletteBar } from "@/components/studio/PaletteBar";
import { ToolButtons } from "@/components/studio/ToolButtons";
import { loadPiano, playNote, unlockAudio } from "@/lib/audio/piano";
import type { Stroke } from "@/lib/paint/types";
import { usePainting } from "@/store/paintingStore";

/**
 * The studio.
 *
 * Everything except the paper floats above it, translucent, so the artwork is
 * never boxed in by its own interface. The chrome is arranged three ways: a
 * rail beside the sheet on a laptop, the same rail on a tablet, and folded
 * into the bottom dock on a phone where there is no room beside the paper.
 */
export function Studio() {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const title = usePainting((s) => s.title);
  const setTitle = usePainting((s) => s.setTitle);
  const clear = usePainting((s) => s.clear);
  const strokeCount = usePainting((s) => s.strokes.length);

  const requestClear = useCallback(() => setConfirmingClear(true), []);

  // Start downloading samples the moment the studio opens. This needs no user
  // gesture — decoding audio is allowed while the context is still suspended —
  // so the piano is usually ready before anyone finishes their first stroke.
  useEffect(() => {
    void loadPiano();
  }, []);

  // Starting the audio context, by contrast, *does* need a gesture. The first
  // pointerdown is also the start of the first stroke, so the context is
  // running by the time that stroke is released and wants to make a sound.
  useEffect(() => {
    const onFirstGesture = () => void unlockAudio();
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  /**
   * Milestone 2 scaffolding: one note per stroke, just to prove the chain from
   * brush to speaker. Milestone 4 replaces this with a composed phrase — this
   * deliberately crude mapping is exactly the mechanical pixel-to-note
   * translation the product must not ship.
   */
  const previewStroke = useCallback((stroke: Stroke) => {
    const meanY =
      stroke.points.reduce((sum, point) => sum + point.y, 0) / stroke.points.length;
    const scale = ["C3", "E3", "G3", "C4", "E4", "G4", "C5", "E5"];
    const index = Math.round((1 - Math.min(1, Math.max(0, meanY))) * (scale.length - 1));
    playNote({ note: scale[index], duration: 1.6, velocity: 0.7 });
  }, []);

  // Keyboard shortcuts, for the laptop case. Deliberately not advertised in the
  // interface — discovering them is a bonus, needing them is not.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || target.tagName === "INPUT")) return;

      const meta = event.metaKey || event.ctrlKey;
      const state = usePainting.getState();

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (!meta && event.key.toLowerCase() === "b") state.setTool("brush");
      if (!meta && event.key.toLowerCase() === "e") state.setTool("eraser");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="no-select flex h-dvh flex-col overflow-hidden bg-shell">
      {/* -- Top bar --------------------------------------------------------- */}
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-display text-base tracking-tight transition-opacity hover:opacity-80"
        >
          Chroma<span className="text-brass">Canvas</span>
        </Link>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Painting title"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-center text-sm text-ink-muted outline-none transition-colors placeholder:text-ink-faint focus:text-ink"
          placeholder="Untitled"
        />

        <span className="hidden shrink-0 text-xs tabular-nums text-ink-faint sm:block">
          {strokeCount} {strokeCount === 1 ? "stroke" : "strokes"}
        </span>
      </header>

      {/* -- The paper ------------------------------------------------------- */}
      <div className="relative min-h-0 flex-1">
        {/* The bottom padding reserves room for the dock. On a phone the dock
            carries the tools and a two-row palette and is a good deal taller,
            so a portrait sheet would otherwise be painted on underneath it. */}
        <div className="absolute inset-0 px-3 pb-48 pt-1 sm:pb-24 sm:pl-24 sm:pr-8 sm:pt-2">
          <PaintSurface onStrokeCommitted={previewStroke} />
        </div>

        {/* Bottom-left, out of the way of both the rail and the dock. */}
        <div className="pointer-events-none absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
          <AudioStatus />
        </div>

        {/* Rail: beside the sheet from the tablet breakpoint up. */}
        <div className="absolute left-4 top-1/2 hidden -translate-y-1/2 sm:block">
          <ToolButtons orientation="vertical" onRequestClear={requestClear} />
        </div>

        {/* Dock: centred at the bottom, clear of the home indicator on a phone. */}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-3 pb-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="sm:hidden">
            <ToolButtons orientation="horizontal" onRequestClear={requestClear} />
          </div>
          <PaletteBar />
        </div>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title="Clear the painting?"
        body="Every stroke and the music it makes will be removed. This cannot be undone."
        confirmLabel="Clear it"
        onConfirm={() => {
          clear();
          setConfirmingClear(false);
        }}
        onCancel={() => setConfirmingClear(false)}
      />
    </main>
  );
}
