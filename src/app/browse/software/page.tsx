import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { CategoryGrid, categoryMeta } from "@/components/browse/CategoryGrid";
import { plural } from "@/lib/format";

export const metadata = { title: "Software — Knowledge base" };

export default async function BrowseSoftwarePage() {
  const user = await getCurrentUser();
  const categories = await db.category.findMany({
    where: { kind: "SOFTWARE", archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      subcategories: { where: { archivedAt: null }, select: { id: true } },
      _count: {
        select: {
          entries: { where: { status: { not: "archived" }, deletedAt: null } },
        },
      },
    },
  });

  return (
    <PageShell user={user}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Software" }]} />
      <div className="mt-8">
        <h1 className="text-page-title text-ink">Software</h1>
        <p className="mt-3 text-sm text-ink-muted">
          {plural(categories.length, "product")} the team trains on. Pick one
          to see its modules.
        </p>
      </div>
      {categories.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="No software categories yet"
          description="A software category is a product; its modules hold the features."
          action={
            <LinkButton href="/admin/taxonomy" variant="secondary">
              Set one up in taxonomy
            </LinkButton>
          }
        />
      ) : (
        <CategoryGrid
          tiles={categories.map((c) => ({
            slug: c.slug,
            name: c.name,
            description: c.description,
            meta: categoryMeta("SOFTWARE", c.subcategories.length, c._count.entries),
          }))}
        />
      )}
    </PageShell>
  );
}
