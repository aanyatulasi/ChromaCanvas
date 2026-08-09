"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A small modal for the two destructive actions in the app.
 *
 * Uses a real `<dialog>` so the browser supplies focus trapping, Escape, and
 * inertness of the page behind it — all things a hand-rolled overlay gets
 * subtly wrong, and all things that matter when the button underneath deletes
 * someone's painting.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        // A click that lands on the dialog element itself is a click on the
        // backdrop; anything inside hits a child instead.
        if (event.target === ref.current) onCancel();
      }}
      className="chrome m-auto max-w-sm rounded-2xl p-6 text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-shell transition-transform duration-200 ease-soft hover:scale-[1.03]"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
