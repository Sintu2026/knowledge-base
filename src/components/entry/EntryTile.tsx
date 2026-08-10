import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type EntryTileProps = {
  href: string;
  title: string;
  meta: string[];
  draft?: boolean;
  overdue?: boolean;
};

// Compact tile for category pages: title, then a muted line with skill
// count and difficulty (§8.2).
export function EntryTile({ href, title, meta, draft, overdue }: EntryTileProps) {
  return (
    <LinkCard href={href} className="flex min-h-[4.5rem] flex-col gap-1 p-3">
      <span className="text-sm text-ink">{title}</span>
      <span className="mt-auto flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
        {meta.length > 0 ? <span>{meta.join(" · ")}</span> : null}
        {draft ? <Badge>Draft</Badge> : null}
        {overdue ? <Badge variant="warning">Review overdue</Badge> : null}
      </span>
    </LinkCard>
  );
}

type AddTileProps = {
  href: string;
  label: string;
};

// The last tile in every grid: contribution one click from where the gap
// is visible.
export function AddTile({ href, label }: AddTileProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.5rem] items-center justify-center gap-1.5 rounded-card border border-dashed border-hairline-strong p-3 text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      <Plus size={16} aria-hidden />
      {label}
    </Link>
  );
}
