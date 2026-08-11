"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { diffWords, type DiffPart } from "@/lib/diff";
import { relativeTime, sectionLabel } from "@/lib/format";
import { restoreRevision } from "@/lib/actions/revisions";

/*
 * Revision history (§2, §7): a list of versions and, for the selected
 * one, a word-level diff against its predecessor. Restoring writes the
 * snapshot's prose back and records the restore as a new revision —
 * history only grows.
 */

type Kind = "WHAT" | "WHY" | "HOW" | "WHO" | "WHEN";
type Template = "PROCESS" | "FEATURE";

export type HistoryRevision = {
  id: string;
  authorName: string;
  createdAt: string; // ISO
  event: string | null;
  note: string | null;
  title: string;
  summary: string;
  sections: { kind: string; body: string }[];
};

const EVENT_LABELS: Record<string, string> = {
  edit: "Edited",
  publish: "Published",
  revert: "Version restored",
  delete: "Deleted",
  restore: "Brought back",
};

function eventLabel(event: string | null): string {
  return (event && EVENT_LABELS[event]) ?? "Snapshot";
}

function body(revision: HistoryRevision, kind: string): string {
  return revision.sections.find((s) => s.kind === kind)?.body ?? "";
}

function DiffText({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
      {parts.map((part, i) =>
        part.type === "same" ? (
          <span key={i}>{part.text}</span>
        ) : part.type === "add" ? (
          <ins key={i} className="rounded-[3px] bg-accent-tint px-0.5 text-ink no-underline">
            {part.text}
          </ins>
        ) : (
          <del key={i} className="rounded-[3px] bg-danger-tint px-0.5 text-ink-faint line-through">
            {part.text}
          </del>
        ),
      )}
    </p>
  );
}

export function HistoryView({
  entryId,
  template,
  revisions, // newest first
}: {
  entryId: string;
  template: Template;
  revisions: HistoryRevision[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(revisions[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An unknown/cleared selection falls back to the newest revision.
  const index = Math.max(
    0,
    revisions.findIndex((r) => r.id === selectedId),
  );
  const selected = revisions[index];
  const previous = revisions[index + 1] ?? null; // next older

  if (!selected) {
    return (
      <p className="mt-10 text-sm text-ink-muted">
        No versions recorded yet — history starts with the first edit.
      </p>
    );
  }

  // What changed in this version, vs its predecessor (or vs nothing, for
  // the first recorded version).
  const changes: { label: string; parts: DiffPart[] }[] = [];
  const beforeTitle = previous?.title ?? "";
  const beforeSummary = previous?.summary ?? "";
  if (selected.title !== beforeTitle) {
    changes.push({ label: "Title", parts: diffWords(beforeTitle, selected.title) });
  }
  if (selected.summary !== beforeSummary) {
    changes.push({ label: "Summary", parts: diffWords(beforeSummary, selected.summary) });
  }
  for (const kind of ["WHAT", "WHY", "HOW", "WHO", "WHEN"]) {
    const before = previous ? body(previous, kind) : "";
    const after = body(selected, kind);
    if (before !== after) {
      changes.push({
        label: sectionLabel(template, kind as Kind),
        parts: diffWords(before, after),
      });
    }
  }

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await restoreRevision({ entryId, revisionId: selected.id });
      setBusy(false);
      if (result.ok) {
        setConfirming(false);
        setSelectedId(""); // re-select newest once the list refreshes
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setBusy(false);
      setError("Couldn't reach the server — try again.");
    }
  };

  const selectedDate = new Date(selected.createdAt);

  return (
    <div className="mt-10 gap-12 md:grid md:grid-cols-[280px_minmax(0,1fr)]">
      <ol
        aria-label="Versions"
        className="flex flex-col md:sticky md:top-10 md:self-start"
      >
        {revisions.map((revision) => {
          const current = revision.id === selected.id;
          return (
            <li key={revision.id}>
              <button
                type="button"
                onClick={() => setSelectedId(revision.id)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col border-l-2 py-2.5 pl-4 text-left transition-colors",
                  current
                    ? "border-accent"
                    : "border-hairline hover:border-hairline-strong",
                )}
              >
                <span
                  className={cn(
                    "text-sm",
                    current ? "font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {eventLabel(revision.event)}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-meta text-ink-faint">
                  <Avatar name={revision.authorName} size="sm" />
                  {revision.authorName} · {relativeTime(new Date(revision.createdAt))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 md:mt-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section-head text-ink">
            {eventLabel(selected.event)}{" "}
            <span className="text-ink-faint">
              · {relativeTime(selectedDate)} by {selected.authorName}
            </span>
          </h2>
          {index > 0 ? (
            <Button onClick={() => setConfirming(true)}>Restore this version</Button>
          ) : (
            <span className="text-meta text-ink-faint">Current version</span>
          )}
        </div>
        {selected.note ? (
          <p className="mt-2 text-meta text-ink-faint">{selected.note}</p>
        ) : null}

        {changes.length === 0 ? (
          <p className="mt-8 text-sm text-ink-muted">
            No text changes in this version —{" "}
            {selected.event === "publish"
              ? "it marks the moment this was published."
              : "it marks a status change, not an edit."}
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {!previous ? (
              <p className="text-meta text-ink-faint">
                The first recorded version — everything below is new.
              </p>
            ) : null}
            {changes.map((change) => (
              <section key={change.label}>
                <h3 className="section-label">{change.label}</h3>
                <div className="mt-2">
                  <DiffText parts={change.parts} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Restore this version?"
      >
        <p className="text-ink-muted">
          Title, summary and section text return to how they were{" "}
          {relativeTime(selectedDate)} ({selectedDate.toLocaleDateString()}).
          Blocks and recordings aren&rsquo;t touched, and this restore becomes a
          new version — nothing is lost.
        </p>
        {error ? <p className="mt-2 text-danger">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={restore}>
            {busy ? "Restoring…" : "Restore"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
