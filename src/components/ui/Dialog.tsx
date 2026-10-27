"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  title: string;
  /** The words on the close button, e.g. "Done". */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** A modal over the page, the browser's own <dialog>: it keeps the focus inside, Esc closes it, and the focus goes
 *  back to the button that opened it. Tapping the dimmed page around it closes it too. */
export function Dialog({ open, title, closeLabel, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Straight into the first field, so typing can start at once
      dialog.querySelector<HTMLElement>("input")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className="m-auto max-h-[85dvh] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-3xl bg-page p-5 text-ink shadow-[0_12px_40px_rgba(61,59,51,.25)] backdrop:bg-[rgba(47,42,36,.45)]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2>
        <Button variant="ghost" className="-mr-4" onClick={onClose}>{closeLabel}</Button>
      </div>
      {open && children}
    </dialog>
  );
}
