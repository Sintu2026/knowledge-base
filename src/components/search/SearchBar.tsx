"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/*
 * The search input — the product's front door. It must not move or resize
 * between browse and results states, so it owns one stable slot on the
 * landing page. Results rendering arrives in build step 5; the input,
 * URL sync (?q=), and the `/` shortcut are wired now.
 */
export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `/` focuses search from anywhere; Escape clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setQuery = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      else params.delete("q");
      router.replace(params.size ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    }, 200);
  };

  return (
    <div className="relative flex-1">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={inputRef}
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && e.currentTarget.value) {
            e.currentTarget.value = "";
            setQuery("");
          }
        }}
        placeholder="Search the knowledge base"
        aria-label="Search the knowledge base"
        className="h-9 w-full rounded-control border border-hairline bg-surface pl-9 pr-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-hairline-strong"
      />
    </div>
  );
}
