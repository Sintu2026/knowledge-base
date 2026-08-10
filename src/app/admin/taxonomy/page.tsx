import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { TaxonomyAdmin } from "@/components/taxonomy/TaxonomyAdmin";

export const metadata = { title: "Taxonomy — Knowledge base" };

export default async function TaxonomyPage() {
  const user = await getCurrentUser();

  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { entries: true } },
      subcategories: {
        orderBy: { order: "asc" },
        include: { _count: { select: { entries: true } } },
      },
    },
  });

  const data = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    archived: c.archivedAt !== null,
    entryCount: c._count.entries,
    subcategories: c.subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      archived: s.archivedAt !== null,
      entryCount: s._count.entries,
    })),
  }));

  // Active destinations for the "where do its entries move" picker.
  const destinations = categories
    .filter((c) => !c.archivedAt)
    .flatMap((c) =>
      c.subcategories
        .filter((s) => !s.archivedAt)
        .map((s) => ({ id: s.id, label: `${c.name} › ${s.name}` })),
    );

  return (
    <PageShell user={user}>
      <Breadcrumbs items={[{ label: "Browse", href: "/" }, { label: "Taxonomy" }]} />
      <TaxonomyAdmin categories={data} destinations={destinations} />
    </PageShell>
  );
}
