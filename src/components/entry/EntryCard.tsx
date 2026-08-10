import { FileText, Video, Workflow } from "lucide-react";
import { LinkCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const SECTION_LABELS = ["What", "Why", "How", "Who", "When"] as const;

// The completeness signal — the most important thing on the card. Filled
// pills are tinted and medium-weight; empty ones outlined and faint, so
// colour is never the only distinction.
function SectionPills({ filled }: { filled: boolean[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {SECTION_LABELS.map((label, i) => (
        <span
          key={label}
          className={cn(
            "inline-flex h-5 items-center rounded-control px-1.5 text-[11px]",
            filled[i]
              ? "bg-accent-tint font-medium text-accent"
              : "border border-hairline text-ink-faint",
          )}
        >
          {label}
        </span>
      ))}
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

export function EntryCard({ entry }: { entry: EntryCardData }) {
  return (
    <LinkCard href={`/entry/${entry.id}`} className="flex flex-col gap-2 p-4">
      <span className="flex items-start justify-between gap-2">
        <SectionPills filled={entry.filled} />
        <span className="flex gap-1">
          {entry.draft ? <Badge>Draft</Badge> : null}
          {entry.overdue ? <Badge variant="warning">Review overdue</Badge> : null}
        </span>
      </span>
      <span className="text-sm font-medium text-ink">{entry.title}</span>
      {entry.summary ? (
        <span className="line-clamp-2 text-[13px] text-ink-muted">{entry.summary}</span>
      ) : null}
      <span className="mt-auto flex items-center justify-between gap-2 pt-1 text-[13px] text-ink-muted">
        <span className="truncate">{entry.breadcrumb}</span>
        <span className="flex shrink-0 items-center gap-2">
          {entry.skillCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Video size={14} aria-hidden />
              {entry.skillCount}
              <span className="sr-only">skill recordings</span>
            </span>
          ) : null}
          {entry.workflowCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Workflow size={14} aria-hidden />
              {entry.workflowCount}
              <span className="sr-only">workflows</span>
            </span>
          ) : null}
          {entry.documentCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <FileText size={14} aria-hidden />
              {entry.documentCount}
              <span className="sr-only">documents</span>
            </span>
          ) : null}
        </span>
      </span>
    </LinkCard>
  );
}
