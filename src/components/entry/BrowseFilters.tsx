"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/components/ui/Chip";

type BrowseFiltersProps = {
  categories: { slug: string; name: string }[];
};

// Landing filter row: All, each category, Has recording, Needs review (§8.1).
export function BrowseFilters({ categories }: BrowseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat = searchParams.get("cat");
  const hasRecording = searchParams.get("rec") === "1";
  const needsReview = searchParams.get("review") === "1";
  const none = !cat && !hasRecording && !needsReview;

  const apply = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutate(params);
      router.replace(params.size ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip
        active={none}
        onClick={() =>
          apply((p) => {
            p.delete("cat");
            p.delete("rec");
            p.delete("review");
          })
        }
      >
        All
      </Chip>
      {categories.map((category) => (
        <Chip
          key={category.slug}
          active={cat === category.slug}
          onClick={() =>
            apply((p) => {
              if (cat === category.slug) p.delete("cat");
              else p.set("cat", category.slug);
            })
          }
        >
          {category.name}
        </Chip>
      ))}
      <Chip
        active={hasRecording}
        onClick={() => apply((p) => (hasRecording ? p.delete("rec") : p.set("rec", "1")))}
      >
        Has recording
      </Chip>
      <Chip
        active={needsReview}
        onClick={() => apply((p) => (needsReview ? p.delete("review") : p.set("review", "1")))}
      >
        Needs review
      </Chip>
    </div>
  );
}
