import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { CategoryGrid, categoryMeta } from "@/components/browse/CategoryGrid";
import { plural } from "@/lib/format";

export const metadata = { title: "Departments — Knowledge base" };

export default async function BrowseDepartmentsPage() {
  const user = await getCurrentUser();
  const categories = await db.category.findMany({
    where: { kind: "PROCESS", archivedAt: null },
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
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Departments" }]} />
      <div className="mt-8">
        <h1 className="text-page-title text-ink">Departments</h1>
        <p className="mt-3 text-sm text-ink-muted">
          {plural(categories.length, "department")} and their ways of working.
          Pick one to see its areas.
        </p>
      </div>
      {categories.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="No departments yet"
          description="A department category holds areas; each area holds its processes."
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
            meta: categoryMeta("PROCESS", c.subcategories.length, c._count.entries),
          }))}
        />
      )}
    </PageShell>
  );
}
