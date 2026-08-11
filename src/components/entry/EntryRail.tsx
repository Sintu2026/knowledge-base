"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/*
 * The read view's section rail (§8.4): the five section names as anchors,
 * active one in accent, driven by an IntersectionObserver. 120px sticky
 * column from 900px up; below that, a horizontal strip pinned under the
 * header. The Reviewed line sits under a hairline (column layout only —
 * the metadata line under the title carries it on small screens).
 */

export type RailSection = { kind: string; label: string; filled: boolean };

export function EntryRail({
  sections,
  reviewedLabel,
  overdue,
}: {
  sections: RailSection[];
  reviewedLabel: string | null;
  overdue: boolean;
}) {
  const [active, setActive] = useState(sections[0]?.kind ?? "");

  useEffect(() => {
    const order = sections.map((section) => section.kind);
    const elements = order
      .map((kind) => document.getElementById(`section-${kind.toLowerCase()}`))
      .filter((el): el is HTMLElement => el !== null);

    // Active = the last section whose top has passed the reading line
    // (upper third), so a jump lands on the jumped-to section even when a
    // tall neighbour still fills the band. At the very bottom the final
    // rendered section wins — it may be too short to ever reach the line.
    const pick = () => {
      let current = elements[0]?.id ?? "";
      const line = window.innerHeight * 0.35;
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= line) current = el.id;
      }
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom && elements.length > 0) {
        current = elements[elements.length - 1].id;
      }
      if (current) setActive(current.replace("section-", "").toUpperCase());
    };

    // The observer triggers recomputation as section edges cross the band;
    // the passive scroll listener covers the page-bottom case between
    // crossings.
    const observer = new IntersectionObserver(pick, {
      rootMargin: "-10% 0px -60% 0px",
    });
    for (const el of elements) observer.observe(el);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(pick); // initial state, incl. hash arrivals
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [sections]);

  return (
    <nav
      aria-label="Sections"
      className={cn(
        "sticky top-0 z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-hairline bg-canvas px-6 py-2 sm:-mx-8 sm:px-8",
        "min-[900px]:top-10 min-[900px]:z-auto min-[900px]:m-0 min-[900px]:w-[120px] min-[900px]:flex-col min-[900px]:gap-0.5 min-[900px]:self-start min-[900px]:overflow-visible min-[900px]:border-b-0 min-[900px]:bg-transparent min-[900px]:p-0",
      )}
    >
      {sections.map((section) => (
        <a
          key={section.kind}
          href={`#section-${section.kind.toLowerCase()}`}
          aria-current={active === section.kind ? "true" : undefined}
          className={cn(
            "rounded-control py-1 pr-2 text-sm whitespace-nowrap transition-colors",
            active === section.kind
              ? "font-medium text-accent"
              : section.filled
                ? "text-ink-muted hover:text-ink"
                : "text-ink-faint hover:text-ink-muted",
          )}
        >
          {section.label}
        </a>
      ))}
      {reviewedLabel ? (
        <p
          className={cn(
            "mt-4 hidden border-t border-hairline pt-3 text-meta min-[900px]:block",
            overdue ? "text-warning" : "text-ink-faint",
          )}
        >
          {overdue ? "Review overdue" : `Reviewed ${reviewedLabel}`}
        </p>
      ) : null}
    </nav>
  );
}
