"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  findRelated,
  suggestTitleSummary,
  tightenSection,
  whatsMissing,
  type RelatedEntry,
} from "@/lib/actions/assist";

/*
 * Claude assistance, kept deliberately quiet: meta-sized text actions, and
 * every suggestion sits in a read-only pane until the author explicitly
 * accepts it. Nothing here writes into a field on its own.
 */

type Kind = "WHAT" | "WHY" | "HOW" | "WHO" | "WHEN";

function AssistButton({
  busy,
  onClick,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-control text-meta text-ink-faint transition-colors hover:text-accent disabled:pointer-events-none disabled:opacity-60"
    >
      <Sparkles size={12} aria-hidden />
      {busy ? "Asking Claude…" : children}
    </button>
  );
}

function AssistPane({
  label,
  accept,
  onDismiss,
  children,
}: {
  label: string;
  accept?: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 border-l-2 border-hairline-strong pl-4">
      <p className="text-meta text-ink-faint">{label}</p>
      {children}
      <div className="mt-2.5 flex items-center gap-4">
        {accept}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-control text-sm text-ink-faint transition-colors hover:text-ink"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* "Tighten this" on one filled section. Accepting replaces the section text
 * through the editor's normal change path (state + autosave). */
export function TightenAssist({
  entryId,
  kind,
  body,
  onAccept,
}: {
  entryId: string;
  kind: Kind;
  body: string;
  onAccept: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Too little text to meaningfully tighten — stay out of the way.
  if (body.trim().length < 60) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    const result = await tightenSection({ entryId, kind, body });
    setBusy(false);
    if (result.ok) setSuggestion(result.text);
    else setError(result.error);
  };

  return (
    <div className="mt-2">
      {suggestion === null ? (
        <AssistButton busy={busy} onClick={run}>
          Tighten this
        </AssistButton>
      ) : (
        <AssistPane
          label="Suggested rewrite — nothing changes unless you accept it"
          onDismiss={() => setSuggestion(null)}
          accept={
            <button
              type="button"
              className="rounded-control text-sm text-accent transition-colors hover:text-accent-hover"
              onClick={() => {
                onAccept(suggestion);
                setSuggestion(null);
              }}
            >
              Replace section text
            </button>
          }
        >
          <p className="mt-2 text-sm whitespace-pre-wrap text-ink-muted">{suggestion}</p>
        </AssistPane>
      )}
      {error ? <p className="mt-1.5 text-meta text-danger">{error}</p> : null}
    </div>
  );
}

type Pane =
  | { kind: "questions"; questions: string[] }
  | { kind: "titleSummary"; title: string; summary: string }
  | { kind: "related"; related: RelatedEntry[] };

type Running = "questions" | "titleSummary" | "related";

/* The entry-level actions: What's missing?, Suggest title and summary,
 * Find related. All read-only except the explicit title/summary accept. */
export function EntryAssist({
  entryId,
  whatFilled,
  anyFilled,
  beforeRun,
  onAcceptTitleSummary,
}: {
  entryId: string;
  whatFilled: boolean;
  anyFilled: boolean;
  beforeRun: () => Promise<void>;
  onAcceptTitleSummary: (title: string, summary: string) => void;
}) {
  const [busy, setBusy] = useState<Running | null>(null);
  const [pane, setPane] = useState<Pane | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Claude only ever works with what's already written.
  if (!anyFilled) return null;

  const run = async (which: Running, task: () => Promise<Pane | string>) => {
    setBusy(which);
    setError(null);
    // Flush pending autosave first so the server reads what's on screen.
    await beforeRun();
    const outcome = await task();
    setBusy(null);
    if (typeof outcome === "string") setError(outcome);
    else setPane(outcome);
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AssistButton
          busy={busy === "questions"}
          onClick={() =>
            run("questions", async () => {
              const r = await whatsMissing({ entryId });
              return r.ok ? { kind: "questions", questions: r.questions } : r.error;
            })
          }
        >
          What&rsquo;s missing?
        </AssistButton>
        {whatFilled ? (
          <AssistButton
            busy={busy === "titleSummary"}
            onClick={() =>
              run("titleSummary", async () => {
                const r = await suggestTitleSummary({ entryId });
                return r.ok
                  ? { kind: "titleSummary", title: r.title, summary: r.summary }
                  : r.error;
              })
            }
          >
            Suggest title and summary
          </AssistButton>
        ) : null}
        <AssistButton
          busy={busy === "related"}
          onClick={() =>
            run("related", async () => {
              const r = await findRelated({ entryId });
              return r.ok ? { kind: "related", related: r.related } : r.error;
            })
          }
        >
          Find related
        </AssistButton>
      </div>

      {error ? <p className="mt-2 text-meta text-danger">{error}</p> : null}

      {pane?.kind === "questions" ? (
        <AssistPane
          label="A newcomer might still ask"
          onDismiss={() => setPane(null)}
        >
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 marker:text-ink-faint">
            {pane.questions.map((question) => (
              <li key={question} className="text-sm text-ink-muted">
                {question}
              </li>
            ))}
          </ul>
        </AssistPane>
      ) : null}

      {pane?.kind === "titleSummary" ? (
        <AssistPane
          label="Suggested title and summary — accept to fill both fields"
          onDismiss={() => setPane(null)}
          accept={
            <button
              type="button"
              className="rounded-control text-sm text-accent transition-colors hover:text-accent-hover"
              onClick={() => {
                onAcceptTitleSummary(pane.title, pane.summary);
                setPane(null);
              }}
            >
              Use title and summary
            </button>
          }
        >
          <p className="mt-2 text-sm font-medium text-ink">{pane.title}</p>
          <p className="mt-1 text-sm text-ink-muted">{pane.summary}</p>
        </AssistPane>
      ) : null}

      {pane?.kind === "related" ? (
        <AssistPane
          label="Possibly overlapping entries"
          onDismiss={() => setPane(null)}
        >
          {pane.related.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              Nothing overlaps — this looks like new ground.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {pane.related.map((entry) => (
                <li key={entry.id} className="flex min-w-0 flex-col">
                  <Link
                    href={`/entry/${entry.id}`}
                    target="_blank"
                    rel="noopener"
                    className="truncate rounded-control text-sm text-ink transition-colors hover:text-accent"
                  >
                    {entry.title}
                  </Link>
                  <span className="truncate text-meta text-ink-faint">
                    {entry.breadcrumb}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AssistPane>
      ) : null}
    </div>
  );
}
