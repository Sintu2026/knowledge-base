"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteEntry } from "@/lib/actions/entries";

/*
 * Quiet danger text action, only rendered for the owner or an admin. The
 * confirmation names the entry; deletion is soft, so the copy promises
 * recoverability rather than destruction.
 */
export function DeleteEntryAction({
  entryId,
  title,
}: {
  entryId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteEntry({ id: entryId });
    if (result.ok) {
      router.push("/");
      router.refresh();
    } else {
      setBusy(false);
      setError(result.error);
    }
  };

  const displayTitle = title.trim() || "Untitled";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-control text-meta text-ink-faint transition-colors hover:text-danger"
      >
        Delete this entry
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete this entry?">
        <p className="text-ink-muted">
          &ldquo;{displayTitle}&rdquo; disappears from search and browse for
          everyone. Nothing is destroyed — an admin can restore it later.
        </p>
        {error ? <p className="mt-2 text-danger">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={confirm}>
            {busy ? "Deleting…" : "Delete entry"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
