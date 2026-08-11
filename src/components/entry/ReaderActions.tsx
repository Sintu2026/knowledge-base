"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { markReviewed } from "@/lib/actions/entries";
import { addComment } from "@/lib/actions/comments";

/*
 * The read view's footer actions (§8.4). Open access means Edit goes
 * straight to the editor; "Suggest an edit" is for the person who'd rather
 * leave a note than change the page — it writes a Comment the owner sees
 * below.
 */


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
      <div className="flex flex-wrap items-center gap-2.5">
        <LinkButton href={`/entry/${entryId}/edit`} variant="primary">
          Edit
        </LinkButton>
        {isFeature ? (
          <LinkButton href={`/entry/${entryId}/edit`}>
            Add a skill recording
          </LinkButton>
        ) : null}
        <Button onClick={() => setSuggesting((prev) => !prev)}>
          Suggest an edit
        </Button>
        <Button disabled={busy === "review"} onClick={review}>
          {busy === "review" ? "Marking…" : "Mark reviewed"}
        </Button>
        <Button onClick={copy} aria-live="polite">
          {copied ? "Copied" : "Copy link"}
        </Button>
        <LinkButton href={`/entry/${entryId}/history`}>History</LinkButton>
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
