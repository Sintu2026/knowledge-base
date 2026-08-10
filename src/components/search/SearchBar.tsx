"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/*
 * The search input — the product's front door. It must not move or resize
 * between browse and results states, so it owns one stable slot on the
 * landing page. Debounced ?q= URL sync, `/` to focus, Escape to clear.
 */
export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlQ = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const [focused, setFocused] = useState(false);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    // The URL changed under us — back/forward, or Escape pressed while
    // focus was elsewhere. Adopt it unless the user is mid-keystroke
    // (while typing, the URL merely lags the input by the debounce).
    setPrevUrlQ(urlQ);
    if (!focused && urlQ !== value) setValue(urlQ);
  }

  // `/` focuses search from anywhere.
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

  const pushQuery = (q: string) => {
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
    <div className="relative w-full">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          pushQuery(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            setValue("");
            pushQuery("");
          }
        }}
        placeholder="Search the knowledge base"
        aria-label="Search the knowledge base"
        className="h-12 w-full rounded-full border border-hairline bg-surface pl-11 pr-5 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-hairline-strong"
      />
    </div>
  );
}
