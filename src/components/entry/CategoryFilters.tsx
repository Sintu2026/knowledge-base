"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/components/ui/Chip";

type CategoryFiltersProps = {
  kind: "PROCESS" | "SOFTWARE";
};

const DIFFICULTIES = [
  ["BEGINNER", "Beginner"],
  ["INTERMEDIATE", "Intermediate"],
  ["ADVANCED", "Advanced"],
] as const;

export function CategoryFilters({ kind }: CategoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const difficulty = searchParams.get("difficulty");
  const hasRecording = searchParams.get("rec") === "1";
  const needsReview = searchParams.get("review") === "1";
  const none = !difficulty && !hasRecording && !needsReview;

  const apply = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip
        active={none}
        onClick={() =>
          apply((p) => {
            p.delete("difficulty");
            p.delete("rec");
            p.delete("review");
          })
        }
      >
        {kind === "SOFTWARE" ? "All modules" : "All areas"}
      </Chip>
      {kind === "SOFTWARE"
        ? DIFFICULTIES.map(([value, label]) => (
            <Chip
              key={value}
              active={difficulty === value}
              onClick={() =>
                apply((p) => {
                  if (difficulty === value) p.delete("difficulty");
                  else p.set("difficulty", value);
                })
              }
            >
              {label}
            </Chip>
          ))
        : null}
      {kind === "SOFTWARE" ? (
        <Chip
          active={hasRecording}
          onClick={() => apply((p) => (hasRecording ? p.delete("rec") : p.set("rec", "1")))}
        >
          Has recording
        </Chip>
      ) : null}
      <Chip
        active={needsReview}
        onClick={() => apply((p) => (needsReview ? p.delete("review") : p.set("review", "1")))}
      >
        Needs review
      </Chip>
    </div>
  );
}
