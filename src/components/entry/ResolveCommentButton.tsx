"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveComment } from "@/lib/actions/comments";

// Quiet per-suggestion action: handled suggestions leave the page but
// stay in the database.
export function ResolveCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await resolveComment({ id: commentId });
        setBusy(false);
        if (result.ok) router.refresh();
      }}
      className="rounded-control text-meta text-ink-faint transition-colors hover:text-accent disabled:opacity-60"
    >
      {busy ? "Resolving…" : "Resolve"}
    </button>
  );
}
