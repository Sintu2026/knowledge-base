"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const linkBase = "rounded-control px-2.5 py-1.5 text-sm transition-colors";

export function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mine = searchParams.get("owner") === "me";

  const browseActive = !mine && (pathname === "/" || pathname.startsWith("/c/"));

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/"
        aria-current={browseActive ? "page" : undefined}
        className={cn(
          linkBase,
          browseActive ? "font-medium text-accent" : "text-ink-muted hover:bg-sunken hover:text-ink",
        )}
      >
        Browse
      </Link>
      <Link
        href="/?owner=me"
        aria-current={mine ? "page" : undefined}
        className={cn(
          linkBase,
          mine ? "font-medium text-accent" : "text-ink-muted hover:bg-sunken hover:text-ink",
        )}
      >
        Your entries
      </Link>
    </nav>
  );
}
