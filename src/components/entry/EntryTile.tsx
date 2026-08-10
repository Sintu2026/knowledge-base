import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type EntryTileProps = {
  href: string;
  title: string;
  meta: string[];
  draft?: boolean;
  overdue?: boolean;
};

// Compact borderless block for category pages: title, then a muted line
// with skill count and difficulty (§8.2). Badges keep their own slot so
// the meta line stays uniform.
export function EntryTile({ href, title, meta, draft, overdue }: EntryTileProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-control transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      <span className="text-card-title text-ink group-hover:text-accent">
        {title}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-meta text-ink-faint">
        {meta.length > 0 ? <span>{meta.join(" · ")}</span> : null}
        {draft ? <Badge>Draft</Badge> : null}
        {overdue ? <Badge variant="warning">Review overdue</Badge> : null}
      </span>
    </Link>
  );
}

type AddTileProps = {
  href: string;
  label: string;
};

// Contribution stays one click from where the gap is visible — as a quiet
// text link now, not a dashed box competing with real content.
export function AddTile({ href, label }: AddTileProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 self-start rounded-control text-sm text-ink-faint transition-colors hover:text-accent"
    >
      <Plus size={15} aria-hidden />
      {label}
    </Link>
  );
}
