"use client";

import { Brush, Eraser, Redo2, Trash2, Undo2 } from "lucide-react";
import { usePainting } from "@/store/paintingStore";

type Props = {
  orientation: "vertical" | "horizontal";
  onRequestClear: () => void;
};

/**
 * Brush, eraser, undo, redo, clear.
 *
 * Rendered twice — as a floating rail beside the paper on a laptop or tablet,
 * and folded into the bottom dock on a phone, where there is no room beside
 * the sheet for anything. The behaviour lives here once; only the axis differs.
 */
export function ToolButtons({ orientation, onRequestClear }: Props) {
  const tool = usePainting((s) => s.tool);
  const setTool = usePainting((s) => s.setTool);
  const undo = usePainting((s) => s.undo);
  const redo = usePainting((s) => s.redo);
  const canUndo = usePainting((s) => s.strokes.length > 0);
  const canRedo = usePainting((s) => s.redoStack.length > 0);
  const canClear = usePainting((s) => s.strokes.length > 0);

  return (
    <div
      className={
        orientation === "vertical"
          ? "chrome flex flex-col gap-1 rounded-2xl p-1.5"
          : "chrome flex items-center gap-1 rounded-full p-1.5"
      }
    >
      <ToolButton
        label="Brush"
        active={tool === "brush"}
        onClick={() => setTool("brush")}
      >
        <Brush size={18} />
      </ToolButton>
      <ToolButton
        label="Eraser — tap a stroke to remove it"
        active={tool === "eraser"}
        onClick={() => setTool("eraser")}
      >
        <Eraser size={18} />
      </ToolButton>

      <span
        aria-hidden
        className={
          orientation === "vertical"
            ? "my-1 h-px w-full bg-hairline"
            : "mx-1 h-6 w-px bg-hairline"
        }
      />

      <ToolButton label="Undo" disabled={!canUndo} onClick={undo}>
        <Undo2 size={18} />
      </ToolButton>
      <ToolButton label="Redo" disabled={!canRedo} onClick={redo}>
        <Redo2 size={18} />
      </ToolButton>
      <ToolButton label="Clear painting" disabled={!canClear} onClick={onRequestClear}>
        <Trash2 size={18} />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        // 44px is the smallest target a fingertip reliably hits; on a phone the
        // dock is the only way to reach these, so they never shrink below it.
        "flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 ease-soft",
        active ? "bg-brass/15 text-brass" : "text-ink-muted hover:text-ink",
        disabled ? "pointer-events-none opacity-30" : "hover:bg-raised",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
