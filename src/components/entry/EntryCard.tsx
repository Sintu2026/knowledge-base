import Link from "next/link";
import { FileText, Video, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const SECTION_LABELS = ["What", "Why", "How", "Who", "When"] as const;

// The completeness signal: five 16×3px bars, filled accent / empty muted.
// Same information as the old pills, far less furniture. A visually hidden
// summary carries the signal for screen readers, where colour can't.
export function SectionBars({ filled }: { filled: boolean[] }) {
  const filledNames = SECTION_LABELS.filter((_, i) => filled[i]);
  return (
    <span className="inline-flex items-center gap-[5px]" aria-hidden={false}>
      {SECTION_LABELS.map((label, i) => (
        <span
          key={label}
          title={`${label} — ${filled[i] ? "filled" : "empty"}`}
          aria-hidden
          className={cn(
            "h-[3px] w-4 rounded-full",
            // Slightly dimmed in dark mode so titles lead the page.
            filled[i] ? "bg-accent dark:opacity-75" : "bg-hairline-strong",
          )}
        />
      ))}
      <span className="sr-only">
        {filledNames.length} of 5 sections filled
        {filledNames.length > 0 ? `: ${filledNames.join(", ")}` : ""}
      </span>
    </span>
  );
}

export type EntryCardData = {
  id: string;
  title: string;
  summary: string;
  draft: boolean;
  overdue: boolean;
  breadcrumb: string; // "Category › Subcategory"
  filled: boolean[]; // WHAT..WHEN in order
  skillCount: number;
  workflowCount: number;
  documentCount: number;
};

// A borderless content block — separation comes from the grid's whitespace
// (32px vertical, 28px horizontal), not from boxes.
export function EntryCard({ entry }: { entry: EntryCardData }) {
  const hasCounts =
    entry.skillCount > 0 || entry.workflowCount > 0 || entry.documentCount > 0;
  return (
    <Link
      href={`/entry/${entry.id}`}
      className="group flex flex-col gap-2.5 rounded-control transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      {/* mb pushes the bars 16px clear of the title so they read as a
          separate signal, not part of the heading. */}
      <span className="mb-1.5 flex items-center gap-2.5">
        <SectionBars filled={entry.filled} />
        {entry.draft ? <Badge>Draft</Badge> : null}
        {entry.overdue ? <Badge variant="warning">Review overdue</Badge> : null}
      </span>
      <span className="text-card-title text-ink group-hover:text-accent">
        {entry.title}
      </span>
      {entry.summary ? (
        <span className="line-clamp-2 text-sm text-ink-muted">{entry.summary}</span>
      ) : null}
      <span className="mt-auto flex items-center justify-between gap-2 pt-0.5 text-meta text-ink-faint">
        <span className="truncate">{entry.breadcrumb}</span>
        {hasCounts ? (
          <span className="flex shrink-0 items-center gap-2.5">
            {entry.skillCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Video size={13} aria-hidden />
                {entry.skillCount}
                <span className="sr-only">skill recordings</span>
              </span>
            ) : null}
            {entry.workflowCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Workflow size={13} aria-hidden />
                {entry.workflowCount}
                <span className="sr-only">workflows</span>
              </span>
            ) : null}
            {entry.documentCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <FileText size={13} aria-hidden />
                {entry.documentCount}
                <span className="sr-only">documents</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
