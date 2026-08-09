"use client";

import { create } from "zustand";
import { createId } from "@/lib/id";
import { DEFAULT_BRUSH_SIZE } from "@/lib/paint/brush";
import { DEFAULT_PAINT_ID, type PaintId } from "@/lib/paint/palette";
import { clampAspect, DEFAULT_ASPECT, type BrushSizeId, type RawPoint, type Stroke } from "@/lib/paint/types";
import { hashSeed } from "@/lib/music/rng";
import { generatePhrase } from "@/lib/music/phrase";
import { DEFAULT_SCALE, getScale, type ScaleId } from "@/lib/music/scales";
import { extractFeatures } from "@/lib/strokes/features";

export type Tool = "brush" | "eraser";

type PaintingState = {
  // -- The painting -------------------------------------------------------
  id: string;
  title: string;
  /** Seeds every phrase in the piece. Fixed for the life of the painting. */
  seed: number;
  scaleId: ScaleId;
  tempo: number;
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
  setTempo: (tempo: number) => void;
  /** Changing the key reinterprets the whole painting's music. */
  setScale: (scaleId: ScaleId) => void;
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
  scaleId: DEFAULT_SCALE,
  tempo: 84,
  aspect: DEFAULT_ASPECT,
  strokes: [],
  nextOrder: 0,
  redoStack: [],

  tool: "brush",
  colorId: DEFAULT_PAINT_ID,
  sizeId: DEFAULT_BRUSH_SIZE,

  commitStroke: (points) => {
    if (points.length < MIN_POINTS) return null;

    const { strokes, colorId, sizeId, seed, nextOrder, scaleId } = get();
    const order = nextOrder;
    const phraseSeed = hashSeed(seed, order, colorId);

    const features = extractFeatures(points);
    const phrase = generatePhrase({
      scale: getScale(scaleId),
      colorId,
      features,
      seed: phraseSeed,
      order,
      // The painting's opening idea, which later phrases restate and vary.
      motif: strokes.length > 0 ? strokes[0].phrase : null,
      previousDegree:
        strokes.length > 0 ? strokes[strokes.length - 1].phrase.chordDegree : 0,
    });

    const stroke: Stroke = {
      id: createId("s"),
      order,
      points,
      colorId,
      sizeId,
      // Derived from the painting seed and the stroke's position, so a
      // reloaded painting looks pixel-identical rather than freshly speckled.
      jitter: (hashSeed(seed, order) % 1000) / 1000,
      features,
      phraseSeed,
      phrase,
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
  setTempo: (tempo) => set({ tempo: Math.round(Math.min(140, Math.max(56, tempo))) }),

  /**
   * Change the key, and rewrite every phrase in it.
   *
   * Transposing the existing notes would drag them out of the new scale, so
   * the phrases are regenerated from the strokes instead. Because generation
   * is deterministic this is exact rather than approximate: the same painting
   * in the same key always produces the same music, so switching away and back
   * returns the original piece note for note.
   */
  setScale: (scaleId) => {
    const { strokes, seed } = get();
    const scale = getScale(scaleId);

    const rewritten: Stroke[] = [];
    for (const stroke of strokes) {
      rewritten.push({
        ...stroke,
        phrase: generatePhrase({
          scale,
          colorId: stroke.colorId,
          features: stroke.features,
          seed: hashSeed(seed, stroke.order, stroke.colorId),
          order: stroke.order,
          motif: rewritten.length > 0 ? rewritten[0].phrase : null,
          previousDegree:
            rewritten.length > 0
              ? rewritten[rewritten.length - 1].phrase.chordDegree
              : 0,
        }),
      });
    }

    set({ scaleId, strokes: rewritten });
  },
}));
