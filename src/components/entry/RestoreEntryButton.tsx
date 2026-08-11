"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreEntry } from "@/lib/actions/entries";

// The recoverable half of soft delete: one quiet action, back into
// search and browse the moment it lands.
export function RestoreEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-meta text-danger">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await restoreEntry({ id: entryId });
          setBusy(false);
          if (result.ok) router.refresh();
          else setError(result.error);
        }}
        className="rounded-control text-sm text-accent transition-colors hover:text-accent-hover disabled:opacity-60"
      >
        {busy ? "Restoring…" : "Restore"}
      </button>
    </span>
  );
}
