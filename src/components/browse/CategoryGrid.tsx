import Link from "next/link";
import { plural } from "@/lib/format";

export type CategoryTile = {
  slug: string;
  name: string;
  description: string;
  meta: string; // "4 modules · 6 features"
};

// One kind of choice per screen: small borderless tiles, nothing else.
export function CategoryGrid({ tiles }: { tiles: CategoryTile[] }) {
  return (
    <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-7 gap-y-10">
      {tiles.map((tile) => (
        <Link
          key={tile.slug}
          href={`/c/${tile.slug}`}
          className="group flex flex-col gap-1.5 rounded-control transition-transform duration-150 ease-out hover:-translate-y-0.5"
        >
          <span className="text-card-title text-ink group-hover:text-accent">
            {tile.name}
          </span>
          <span className="text-meta text-ink-faint">{tile.meta}</span>
          {tile.description ? (
            <span className="line-clamp-2 text-sm text-ink-muted">
              {tile.description}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function categoryMeta(kind: "SOFTWARE" | "PROCESS", subs: number, entries: number): string {
  return kind === "SOFTWARE"
    ? `${plural(subs, "module")} · ${plural(entries, "feature")}`
    : `${plural(subs, "area")} · ${plural(entries, "process", "processes")}`;
}
