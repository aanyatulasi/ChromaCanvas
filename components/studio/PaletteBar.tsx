"use client";

import { BRUSH_SIZES } from "@/lib/paint/brush";
import { PAINTS } from "@/lib/paint/palette";
import { usePainting } from "@/store/paintingStore";

/**
 * The pigments and the brush sizes.
 *
 * Seven fixed swatches rather than a colour picker: each pigment is also a way
 * of playing the piano, so an arbitrary hue would have no voice. The size
 * control shows actual dots at their relative weights — a slider labelled in
 * pixels would mean nothing on a sheet whose size changes with the window.
 */
export function PaletteBar() {
  const colorId = usePainting((s) => s.colorId);
  const setColor = usePainting((s) => s.setColor);
  const sizeId = usePainting((s) => s.sizeId);
  const setSize = usePainting((s) => s.setSize);

  return (
    // Seven pigments and five sizes in one row is wider than a phone. Below the
    // tablet breakpoint they stack instead of scrolling sideways — a control
    // you have to discover by swiping is a control most people never find.
    <div className="chrome flex flex-col items-center gap-1 rounded-3xl px-3 py-2 sm:flex-row sm:gap-3 sm:rounded-full">
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Paint colour">
        {PAINTS.map((paint) => {
          const selected = paint.id === colorId;
          return (
            <button
              key={paint.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${paint.label} — ${paint.character}`}
              title={`${paint.label} — ${paint.character}`}
              onClick={() => setColor(paint.id)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 ease-soft hover:scale-110"
            >
              <span
                className={[
                  "block rounded-full transition-all duration-200 ease-soft",
                  selected ? "h-7 w-7 ring-2 ring-ink ring-offset-2 ring-offset-panel" : "h-6 w-6",
                ].join(" ")}
                style={{ backgroundColor: paint.hex }}
              />
            </button>
          );
        })}
      </div>

      <span aria-hidden className="hidden h-6 w-px bg-hairline sm:block" />

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Brush size">
        {BRUSH_SIZES.map((size) => {
          const selected = size.id === sizeId;
          // Scaled for legibility in a 36px button rather than shown at true
          // paper scale, which would make "fine" an invisible speck.
          const dot = 4 + size.width * 190;
          return (
            <button
              key={size.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${size.label} brush`}
              title={`${size.label} brush`}
              onClick={() => setSize(size.id)}
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 ease-soft",
                selected ? "bg-brass/15" : "hover:bg-raised",
              ].join(" ")}
            >
              <span
                className="block rounded-full transition-colors duration-200"
                style={{
                  width: dot,
                  height: dot,
                  backgroundColor: selected ? "var(--color-brass)" : "var(--color-ink-muted)",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
