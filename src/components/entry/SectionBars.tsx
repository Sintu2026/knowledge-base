import { cn } from "@/lib/cn";

const SECTION_LABELS = ["What", "Why", "How", "Who", "When"] as const;

// The completeness signal: five 16×3px bars, filled accent / empty muted.
// A visually hidden summary carries the signal for screen readers, where
// colour can't.
export function SectionBars({ filled }: { filled: boolean[] }) {
  const filledNames = SECTION_LABELS.filter((_, i) => filled[i]);
  return (
    <span className="inline-flex items-center gap-[5px]">
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

export type SectionFill = { kind: string; body: string; blockCount: number };

// Shared fill logic: a section counts as filled with body text, blocks, or
// (for HOW) skills.
export function computeFilled(
  sections: { kind: string; body: string; blocks?: { type: string }[] }[],
  skillCount: number,
): boolean[] {
  return ["WHAT", "WHY", "HOW", "WHO", "WHEN"].map((kind) => {
    const section = sections.find((s) => s.kind === kind);
    if (!section) return false;
    return (
      section.body.trim() !== "" ||
      (section.blocks?.length ?? 0) > 0 ||
      (kind === "HOW" && skillCount > 0)
    );
  });
}
