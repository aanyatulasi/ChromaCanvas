"use client";

import { useMemo } from "react";
import { usePainting } from "@/store/paintingStore";
import { arrange, type Arrangement } from "./arrange";
import { getScale } from "./scales";

/**
 * The finished piece, derived from the painting.
 *
 * An arrangement is a pure function of the strokes, the key and the tempo, so
 * it is recomputed rather than stored. That means it can never drift out of
 * step with the painting — there is no stale copy to invalidate, and no moment
 * where the music describes a stroke that has been undone.
 *
 * Both the transport and the canvas need it: one to play the notes, the other
 * to know when each stroke is sounding.
 */
export function useArrangement(): Arrangement {
  const strokes = usePainting((s) => s.strokes);
  const scaleId = usePainting((s) => s.scaleId);
  const tempo = usePainting((s) => s.tempo);

  return useMemo(() => arrange(strokes, getScale(scaleId), tempo), [strokes, scaleId, tempo]);
}
