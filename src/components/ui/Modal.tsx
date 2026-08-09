"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

/*
 * Built on native <dialog>: focus trap, Escape handling, and focus
 * restoration come from the platform.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
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
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-card border border-hairline bg-surface p-0 text-ink backdrop:bg-transparent"
    >
      <div className="flex items-center justify-between gap-4 px-5 pt-4">
        <h2 className="text-section-head font-medium">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close"
          onClick={() => ref.current?.close()}
          className="-mr-1.5 px-1.5"
        >
          <X size={16} />
        </Button>
      </div>
      <div className="px-5 py-4 text-sm">{children}</div>
      {footer ? (
        <div className="flex justify-end gap-2 px-5 pb-5">{footer}</div>
      ) : null}
    </dialog>
  );
}
