"use client";

import { create } from "zustand";
import { createId } from "@/lib/id";
import { DEFAULT_BRUSH_SIZE } from "@/lib/paint/brush";
import { DEFAULT_PAINT_ID, type PaintId } from "@/lib/paint/palette";
import { clampAspect, DEFAULT_ASPECT, type BrushSizeId, type RawPoint, type Stroke } from "@/lib/paint/types";
import { hashSeed } from "@/lib/music/rng";

export type Tool = "brush" | "eraser";

type PaintingState = {
  // -- The painting -------------------------------------------------------
  id: string;
  title: string;
  /** Seeds every phrase in the piece. Fixed for the life of the painting. */
  seed: number;
  aspect: number;
  strokes: Stroke[];
  /**
   * Monotonic. A stroke's `order` seeds its phrase, so it must be unique for
   * the life of the painting — reusing `strokes.length` would hand a new
   * stroke the same seed as a surviving one after an erase in the middle, and
   * two strokes would play the identical melody.
   */
  nextOrder: number;

  // -- Undo history -------------------------------------------------------
  /**
   * Removed strokes, newest last. Holds whole `Stroke` objects rather than
   * diffs, so redo restores the original — including, once the music engine
   * lands, its exact phrase.
   */
  redoStack: Stroke[];

  // -- Tools --------------------------------------------------------------
  tool: Tool;
  colorId: PaintId;
  sizeId: BrushSizeId;

  // -- Actions ------------------------------------------------------------
  commitStroke: (points: RawPoint[]) => Stroke | null;
  eraseStroke: (id: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setTool: (tool: Tool) => void;
  setColor: (colorId: PaintId) => void;
  setSize: (sizeId: BrushSizeId) => void;
  setTitle: (title: string) => void;
  setAspect: (aspect: number) => void;
};

/**
 * A stroke needs at least a couple of samples to have a shape. A single tap
 * produces one point and no direction, which perfect-freehand renders as
 * nothing and the music engine could not read a contour from.
 */
const MIN_POINTS = 2;

export const usePainting = create<PaintingState>((set, get) => ({
  id: createId("p"),
  title: "Untitled",
  seed: hashSeed(Date.now(), Math.random()),
  aspect: DEFAULT_ASPECT,
  strokes: [],
  nextOrder: 0,
  redoStack: [],

  tool: "brush",
  colorId: DEFAULT_PAINT_ID,
  sizeId: DEFAULT_BRUSH_SIZE,

  commitStroke: (points) => {
    if (points.length < MIN_POINTS) return null;

    const { strokes, colorId, sizeId, seed, nextOrder } = get();
    const order = nextOrder;

    const stroke: Stroke = {
      id: createId("s"),
      order,
      points,
      colorId,
      sizeId,
      // Derived from the painting seed and the stroke's position, so a
      // reloaded painting looks pixel-identical rather than freshly speckled.
      jitter: (hashSeed(seed, order) % 1000) / 1000,
    };

    // Painting after an undo discards the redo history, the same as every
    // other editor — the timeline has branched and the old branch is gone.
    set({ strokes: [...strokes, stroke], nextOrder: order + 1, redoStack: [] });
    return stroke;
  },

  eraseStroke: (id) => {
    const { strokes } = get();
    const stroke = strokes.find((s) => s.id === id);
    if (!stroke) return;
    set({
      strokes: strokes.filter((s) => s.id !== id),
      redoStack: [...get().redoStack, stroke],
    });
  },

  undo: () => {
    const { strokes, redoStack } = get();
    if (strokes.length === 0) return;
    set({
      strokes: strokes.slice(0, -1),
      redoStack: [...redoStack, strokes[strokes.length - 1]],
    });
  },

  redo: () => {
    const { strokes, redoStack } = get();
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    set({
      strokes: [...strokes, restored],
      redoStack: redoStack.slice(0, -1),
    });
  },

  clear: () => set({ strokes: [], redoStack: [], nextOrder: 0 }),

  setTool: (tool) => set({ tool }),
  setColor: (colorId) => set({ colorId, tool: "brush" }),
  setSize: (sizeId) => set({ sizeId }),
  setTitle: (title) => set({ title }),
  setAspect: (aspect) => set({ aspect: clampAspect(aspect) }),
}));
