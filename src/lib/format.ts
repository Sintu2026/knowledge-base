import type {
  CategoryKind,
  EntryTemplate,
  SectionKind,
} from "../generated/prisma/client";

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

// Vocabulary by category kind: a SOFTWARE category holds modules of features;
// a PROCESS category holds areas of processes.
export function vocab(kind: CategoryKind) {
  return kind === "SOFTWARE"
    ? { sub: "module", entry: "feature", entryPlural: "features" }
    : { sub: "area", entry: "process", entryPlural: "processes" };
}

export function isReviewOverdue(entry: {
  reviewedAt: Date | null;
  reviewIntervalDays: number | null;
  createdAt: Date;
}): boolean {
  if (!entry.reviewIntervalDays) return false;
  const last = entry.reviewedAt ?? entry.createdAt;
  return Date.now() - last.getTime() > entry.reviewIntervalDays * 24 * 60 * 60 * 1000;
}

// Coarse relative time for review stamps — day precision is plenty.
export function relativeTime(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365 * 2) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Section labels by template (§5). One entry model, one label table.
const SECTION_LABELS: Record<EntryTemplate, Record<SectionKind, string>> = {
  PROCESS: { WHAT: "What", WHY: "Why", HOW: "How", WHO: "Who", WHEN: "When" },
  FEATURE: {
    WHAT: "What it does",
    WHY: "Why it matters",
    HOW: "Skills — how to do it",
    WHO: "Who uses it",
    WHEN: "When to use it",
  },
};

export function sectionLabel(template: EntryTemplate, kind: SectionKind): string {
  return SECTION_LABELS[template][kind];
}

// Editor hints under each section label (§5), template-dependent.
const SECTION_HINTS: Record<EntryTemplate, Record<SectionKind, string>> = {
  PROCESS: {
    WHAT: "The thing itself, in one paragraph",
    WHY: "The reason it exists and what breaks without it",
    HOW: "The steps, in order",
    WHO: "Owner, approvers, and who to ask",
    WHEN: "Triggers, deadlines, and review cadence",
  },
  FEATURE: {
    WHAT: "What this feature is for",
    WHY: "What goes wrong without it",
    HOW: "Record yourself doing it, one skill per recording",
    WHO: "Roles and teams who need this",
    WHEN: "The moment in the workflow where this happens",
  },
};

export function sectionHint(template: EntryTemplate, kind: SectionKind): string {
  return SECTION_HINTS[template][kind];
}
