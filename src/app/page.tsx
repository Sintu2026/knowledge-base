import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { LinkCard } from "@/components/ui/Card";
import { plural, vocab } from "@/lib/format";

export default async function HomePage() {
  const user = await getCurrentUser();
  const categories = await db.category.findMany({
    where: { archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { entries: { where: { status: { not: "archived" } } } } },
    },
  });

  return (
    <PageShell user={user}>
      <div className="flex flex-1 flex-col gap-6 py-4">
        <EmptyState
          title="Browse and search arrive in build steps 4 and 5"
          description="The taxonomy is live — open a category, or manage the structure in taxonomy admin."
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/admin/taxonomy" variant="secondary">
                Manage taxonomy
              </LinkButton>
              <LinkButton href="/kitchen-sink" variant="secondary">
                Kitchen sink
              </LinkButton>
            </span>
          }
        />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {categories.map((category) => (
            <LinkCard key={category.id} href={`/c/${category.slug}`} className="p-3">
              <span className="text-sm font-medium text-ink">{category.name}</span>
              <span className="mt-1 block text-[13px] text-ink-muted">
                {plural(
                  category._count.entries,
                  vocab(category.kind).entry,
                  vocab(category.kind).entryPlural,
                )}
              </span>
            </LinkCard>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
