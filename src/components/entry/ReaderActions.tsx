"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { markReviewed } from "@/lib/actions/entries";
import { addComment } from "@/lib/actions/comments";

/*
 * The read view's footer actions (§8.4). Open access means Edit goes
 * straight to the editor; "Suggest an edit" is for the person who'd rather
 * leave a note than change the page — it writes a Comment the owner sees
 * below.
 */

const actionClass =
  "rounded-control text-sm text-ink-muted transition-colors hover:text-accent";

export function ReaderActions({
  entryId,
  isFeature,
}: {
  entryId: string;
  isFeature: boolean;
}) {
  const router = useRouter();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState<"send" | "review" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSuggestion = async () => {
    setBusy("send");
    setError(null);
    const result = await addComment({ entryId, body: suggestion });
    setBusy(null);
    if (result.ok) {
      setSuggesting(false);
      setSuggestion("");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const review = async () => {
    setBusy("review");
    setError(null);
    const result = await markReviewed({ id: entryId });
    setBusy(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/entry/${entryId}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copying isn't available here — use the address bar.");
    }
  };

  return (
    <div className="border-t border-hairline pt-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {isFeature ? (
          <Link href={`/entry/${entryId}/edit`} className={actionClass}>
            Add a skill recording
          </Link>
        ) : null}
        <Link
          href={`/entry/${entryId}/edit`}
          className="rounded-control text-sm text-accent transition-colors hover:text-accent-hover"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => setSuggesting((prev) => !prev)}
          className={actionClass}
        >
          Suggest an edit
        </button>
        <button
          type="button"
          disabled={busy === "review"}
          onClick={review}
          className={`${actionClass} disabled:opacity-60`}
        >
          {busy === "review" ? "Marking…" : "Mark reviewed"}
        </button>
        <button type="button" onClick={copy} className={actionClass} aria-live="polite">
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {suggesting ? (
        <div className="mt-4 max-w-2xl">
          <Textarea
            autoFocus
            autoGrow
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="What should change, and why? The owner sees this on the page."
            aria-label="Suggested edit"
            className="min-h-16"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy === "send"}
              onClick={sendSuggestion}
            >
              {busy === "send" ? "Sending…" : "Send suggestion"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSuggesting(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-meta text-danger">{error}</p> : null}
    </div>
  );
}
