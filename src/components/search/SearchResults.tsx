"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CornerDownRight, Video } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDuration, plural, sectionLabel } from "@/lib/format";
import type { SearchResponse } from "@/lib/search-types";

const HL_START = "«";
const HL_END = "»";

// Snippets carry «marked» terms; render them in the warning tint.
function Highlight({ text }: { text: string }) {
  const parts = text.split(new RegExp(`${HL_START}([^${HL_END}]*)${HL_END}`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[2px] bg-warning-tint px-0.5 text-warning">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function GroupHeading({ children }: { children: string }) {
  return <h2 className="section-label mt-10 mb-3">{children}</h2>;
}

export function SearchResults() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";

  const [data, setData] = useState<SearchResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json: SearchResponse) => {
        setData(json);
        setFailed(false);
        setSelected(-1);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [q]);

  // Flat list of navigable results, in display order, for the arrow keys.
  const items = useMemo(() => {
    if (!data) return [];
    return [
      ...data.categories.map((c) => ({ key: `c-${c.href}`, href: c.href })),
      ...data.entries.map((e) => ({ key: `e-${e.id}`, href: `/entry/${e.id}` })),
      ...data.skills.map((s) => ({
        key: `s-${s.id}`,
        href: `/entry/${s.entryId}?skill=${s.id}${s.timestamp !== null ? `&t=${s.timestamp}` : ""}`,
      })),
    ];
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (items.length === 0) return;
        e.preventDefault();
        setSelected((prev) => {
          const next =
            e.key === "ArrowDown"
              ? Math.min(prev + 1, items.length - 1)
              : Math.max(prev - 1, -1);
          listRef.current
            ?.querySelector(`[data-index="${next}"]`)
            ?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter") {
        if (selected >= 0 && items[selected]) router.push(items[selected].href);
      } else if (e.key === "Escape") {
        const params = new URLSearchParams(searchParams);
        params.delete("q");
        router.replace(params.size ? `${pathname}?${params}` : pathname, {
          scroll: false,
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selected, router, pathname, searchParams]);

  if (failed) {
    return (
      <p className="mt-6 text-sm text-ink-muted">
        Search didn&apos;t respond. Check the dev server log and try again.
      </p>
    );
  }
  if (!data) {
    return <p className="mt-6 text-sm text-ink-muted">Searching…</p>;
  }

  if (data.total === 0) {
    return (
      <div className="mt-6 flex flex-col items-start gap-3">
        <p className="text-sm text-ink-muted">
          Nothing matched &ldquo;{data.query}&rdquo;.
        </p>
        <LinkButton href={`/new?title=${encodeURIComponent(data.query)}`} variant="primary">
          Add this to the knowledge base
        </LinkButton>
      </div>
    );
  }

  const rowClass = (index: number) =>
    cn(
      "-mx-3 flex flex-col gap-1 rounded-control px-3 py-3 transition-colors hover:bg-sunken",
      selected === index && "bg-sunken",
    );
  let index = -1;

  return (
    <div ref={listRef} className="mt-8">
      <p className="text-sm text-ink-muted" role="status">
        {plural(data.total, "result")} across {plural(data.categoryCount, "category", "categories")}
      </p>

      {data.categories.length > 0 ? (
        <section>
          <GroupHeading>Categories</GroupHeading>
          {data.categories.map((hit) => {
            index++;
            return (
              <Link key={hit.href} href={hit.href} data-index={index} className={rowClass(index)}>
                <span className="text-card-title text-ink">{hit.name}</span>
                <span className="text-meta text-ink-faint">{hit.detail}</span>
              </Link>
            );
          })}
        </section>
      ) : null}

      {data.entries.length > 0 ? (
        <section>
          <GroupHeading>Entries</GroupHeading>
          {data.entries.map((hit) => {
            index++;
            return (
              <Link
                key={hit.id}
                href={`/entry/${hit.id}`}
                data-index={index}
                className={rowClass(index)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-card-title text-ink">{hit.title}</span>
                  <Badge>{hit.template === "FEATURE" ? "Feature" : "Process"}</Badge>
                </span>
                <span className="text-meta text-ink-faint">{hit.breadcrumb}</span>
                {hit.snippet ? (
                  <span className="line-clamp-1 text-sm text-ink-muted">
                    {hit.section ? (
                      <span className="text-ink">
                        {sectionLabel(hit.template, hit.section)} —{" "}
                      </span>
                    ) : null}
                    <Highlight text={hit.snippet} />
                  </span>
                ) : null}
              </Link>
            );
          })}
        </section>
      ) : null}

      {data.skills.length > 0 ? (
        <section>
          <GroupHeading>Skill recordings</GroupHeading>
          {data.skills.map((hit) => {
            index++;
            // The row is the jump: when the hit was in the transcript, the
            // link carries the timestamp and the player starts there.
            const href = `/entry/${hit.entryId}?skill=${hit.id}${hit.timestamp !== null ? `&t=${hit.timestamp}` : ""}`;
            return (
              <Link key={hit.id} href={href} data-index={index} className={rowClass(index)}>
                <span className="flex items-center gap-2">
                  <Video size={16} aria-hidden className="shrink-0 text-ink-muted" />
                  <span className="text-card-title text-ink">{hit.title}</span>
                  {hit.durationSeconds !== null ? (
                    <span className="text-meta text-ink-faint">
                      {formatDuration(hit.durationSeconds)}
                    </span>
                  ) : null}
                </span>
                <span className="text-meta text-ink-faint">{hit.breadcrumb}</span>
                {hit.snippet ? (
                  <span className="line-clamp-1 text-sm text-ink-muted">
                    <Highlight text={hit.snippet} />
                  </span>
                ) : null}
                {hit.timestamp !== null ? (
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">
                    <CornerDownRight size={14} aria-hidden />
                    Jump to {formatDuration(hit.timestamp)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
