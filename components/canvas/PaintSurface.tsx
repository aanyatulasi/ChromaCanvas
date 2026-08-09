"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PaperRect } from "@/lib/paint/brush";
import { drawAll, drawStroke, hitTest } from "@/lib/paint/render";
import type { RawPoint, Stroke } from "@/lib/paint/types";
import { usePainting } from "@/store/paintingStore";

/**
 * Retina phones report a ratio of 3, which would make the backing store nine
 * times the area of the sheet. Two is the point past which nobody can see the
 * difference in a soft-edged brushstroke, and it keeps a full-screen canvas on
 * a tablet well inside a sane memory budget.
 */
const MAX_DPR = 2;

/** Ignore pointer samples closer together than this, in paper pixels. */
const MIN_SAMPLE_DISTANCE = 0.7;

type ActiveStroke = {
  pointerId: number;
  points: RawPoint[];
  startedAt: number;
  hasRealPressure: boolean;
};

/**
 * The painting surface: a sheet of paper you can paint on.
 *
 * Two stacked canvases, and the split is what keeps drawing responsive. The
 * lower one holds every finished stroke and is only repainted when the history
 * actually changes; the upper one holds nothing but the stroke currently under
 * the pointer and is cleared every frame. Without the split, each frame of a
 * drag would have to redraw the entire artwork, and a painting would get
 * slower to paint on the more of it there was.
 */
export function PaintSurface() {
  const containerRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const active = useRef<ActiveStroke | null>(null);
  const frame = useRef<number | null>(null);
  /** Ids already painted onto the committed layer, in order. */
  const drawn = useRef<string[]>([]);

  const [paper, setPaper] = useState<PaperRect>({ width: 0, height: 0 });
  const [dpr, setDpr] = useState(1);

  const strokes = usePainting((s) => s.strokes);
  const aspect = usePainting((s) => s.aspect);
  const tool = usePainting((s) => s.tool);
  const commitStroke = usePainting((s) => s.commitStroke);
  const eraseStroke = usePainting((s) => s.eraseStroke);
  const setAspect = usePainting((s) => s.setAspect);

  // -- Sizing ---------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const box = container.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;

      // An empty sheet takes the shape of the space it is given, so a phone
      // starts a portrait painting and a laptop a landscape one. The moment
      // there is paint on it the shape is part of the artwork and stops
      // following the window.
      const current = usePainting.getState();
      if (current.strokes.length === 0) {
        const wanted = box.width / box.height;
        if (Math.abs(wanted - current.aspect) > 0.01) setAspect(wanted);
      }

      const target = usePainting.getState().aspect;
      // Largest rectangle of the painting's aspect that fits the space.
      const width = Math.min(box.width, box.height * target);
      const height = width / target;

      setPaper((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
      setDpr(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [aspect, setAspect]);

  /**
   * Resize the backing stores and repaint. Canvas contents are discarded by a
   * width/height assignment, which is exactly why strokes are stored as
   * normalised points rather than pixels — the artwork is rebuilt from its
   * source at the new resolution instead of being scaled up and going soft.
   */
  useEffect(() => {
    if (paper.width === 0) return;
    for (const canvas of [committedRef.current, liveRef.current]) {
      if (!canvas) continue;
      canvas.width = Math.round(paper.width * dpr);
      canvas.height = Math.round(paper.height * dpr);
      canvas.style.width = `${paper.width}px`;
      canvas.style.height = `${paper.height}px`;
    }
    drawn.current = [];
  }, [paper, dpr]);

  // -- Keeping the committed layer in step with history ---------------------

  useEffect(() => {
    const canvas = committedRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || paper.width === 0) return;

    // If what is already on the canvas is a prefix of the current history, the
    // only thing that happened was painting, and the new strokes can simply be
    // added. Anything else — undo, erase, clear, load — means the canvas is
    // wrong and has to be rebuilt.
    const isAppend =
      strokes.length >= drawn.current.length &&
      drawn.current.every((id, i) => strokes[i]?.id === id);

    if (isAppend) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = drawn.current.length; i < strokes.length; i++) {
        drawStroke(ctx, strokes[i], paper);
      }
    } else {
      drawAll(ctx, strokes, paper, dpr);
    }
    drawn.current = strokes.map((s) => s.id);
  }, [strokes, paper, dpr]);

  // -- Drawing the in-flight stroke -----------------------------------------

  const renderLive = useCallback(() => {
    frame.current = null;
    const canvas = liveRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, paper.width, paper.height);

    const stroke = active.current;
    if (!stroke || stroke.points.length < 2) return;

    const { colorId, sizeId, seed } = usePainting.getState();
    drawStroke(
      ctx,
      {
        id: "live",
        order: -1,
        points: stroke.points,
        colorId,
        sizeId,
        jitter: (seed % 1000) / 1000,
      },
      paper,
      // The tail stays open until the pointer lifts; tapering it every frame
      // makes the end of the stroke flinch as it is being drawn.
      { last: false, hasRealPressure: stroke.hasRealPressure },
    );
  }, [dpr, paper]);

  const scheduleRender = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(renderLive);
  }, [renderLive]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // -- Pointer input --------------------------------------------------------

  const toPaperPoint = useCallback(
    (clientX: number, clientY: number, pressure: number, startedAt: number): RawPoint => {
      const canvas = liveRef.current!;
      const box = canvas.getBoundingClientRect();
      return {
        // Allowed slightly outside the sheet: a stroke that runs off the edge
        // should keep its true direction rather than being flattened against
        // the border, and the canvas clips the overflow anyway.
        x: clamp((clientX - box.left) / box.width, -0.15, 1.15),
        y: clamp((clientY - box.top) / box.height, -0.15, 1.15),
        pressure: pressure > 0 ? pressure : 0.5,
        t: performance.now() - startedAt,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      // Right-click and middle-click are not painting gestures; a second finger
      // landing mid-stroke must not start a competing one.
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (active.current) return;

      const canvas = liveRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      event.preventDefault();

      const now = performance.now();
      const point = toPaperPoint(event.clientX, event.clientY, event.pressure, now);

      if (usePainting.getState().tool === "eraser") {
        const hit = hitTest(ctx, usePainting.getState().strokes, paper, point);
        if (hit) eraseStroke(hit.id);
        return;
      }

      // Capture keeps a stroke alive when the pointer leaves the sheet mid-drag.
      // It throws if the pointer is no longer active, which is not worth losing
      // the stroke over — without capture the stroke simply ends at the edge.
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* not capturable; carry on uncaptured */
      }

      active.current = {
        pointerId: event.pointerId,
        points: [point],
        startedAt: now,
        hasRealPressure: event.pointerType === "pen",
      };
    },
    [eraseStroke, paper, toPaperPoint],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const stroke = active.current;
      if (!stroke || stroke.pointerId !== event.pointerId) return;

      event.preventDefault();

      // A stylus or a 120Hz trackpad generates far more samples than the
      // browser fires events for; the coalesced list is where the detail that
      // makes a curve smooth actually lives.
      const native = event.nativeEvent;
      const events =
        typeof native.getCoalescedEvents === "function"
          ? native.getCoalescedEvents()
          : [native];

      const minDistance = MIN_SAMPLE_DISTANCE / Math.max(paper.width, 1);

      for (const sample of events.length > 0 ? events : [native]) {
        const point = toPaperPoint(
          sample.clientX,
          sample.clientY,
          sample.pressure,
          stroke.startedAt,
        );
        const last = stroke.points[stroke.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) < minDistance) continue;
        stroke.points.push(point);
      }

      scheduleRender();
    },
    [paper.width, scheduleRender, toPaperPoint],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
      const stroke = active.current;
      if (!stroke || stroke.pointerId !== event.pointerId) return;

      active.current = null;
      const canvas = liveRef.current;
      try {
        if (canvas?.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* already released */
      }

      let committed: Stroke | null = null;
      if (!cancelled) committed = commitStroke(stroke.points);

      // The committed layer repaints in an effect, one tick later. Clearing the
      // live layer now would blink the stroke out and back in, so it is left in
      // place and cleared on the next frame instead.
      if (committed) {
        requestAnimationFrame(() => {
          const ctx = liveRef.current?.getContext("2d");
          if (!ctx) return;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, paper.width, paper.height);
        });
      } else {
        scheduleRender();
      }
    },
    [commitStroke, dpr, paper.height, paper.width, scheduleRender],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => finish(event, false),
    [finish],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => finish(event, true),
    [finish],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        className="paper relative overflow-hidden rounded-lg"
        style={{ width: paper.width || undefined, height: paper.height || undefined }}
      >
        <canvas ref={committedRef} className="absolute inset-0" aria-hidden />
        <canvas
          ref={liveRef}
          className="absolute inset-0 touch-none"
          style={{ cursor: tool === "eraser" ? "pointer" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          role="application"
          aria-label="Painting canvas. Press and drag to paint a stroke."
        />
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
