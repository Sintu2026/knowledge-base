import type { CategoryKind } from "../generated/prisma/client";

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

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
