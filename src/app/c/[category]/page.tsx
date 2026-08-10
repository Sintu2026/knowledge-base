import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plural, vocab } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RowLink, RowList } from "@/components/ui/Row";

export async function generateMetadata(props: PageProps<"/c/[category]">) {
  const { category } = await props.params;
  const row = await db.category.findUnique({ where: { slug: category } });
  return { title: row ? `${row.name} — Knowledge base` : "Knowledge base" };
}

/*
 * One kind of choice per screen: this level lists only the modules or
 * areas — a plain bordered list with counts. Entries appear one level
 * down, so a product with twenty modules stays a clean list.
 */
export default async function CategoryPage(props: PageProps<"/c/[category]">) {
  const [{ category: slug }, user] = await Promise.all([
    props.params,
    getCurrentUser(),
  ]);

  const category = await db.category.findFirst({
    where: { slug, archivedAt: null },
    include: {
      subcategories: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        include: {
          _count: { select: { entries: { where: { status: { not: "archived" } } } } },
        },
      },
    },
  });
  if (!category) notFound();

  const words = vocab(category.kind);
  const entryCount = category.subcategories.reduce((n, s) => n + s._count.entries, 0);
  const skillCount = await db.skill.count({
    where: { entry: { categoryId: category.id, status: { not: "archived" } } },
  });

  const countsLine =
    category.kind === "SOFTWARE"
      ? `${plural(category.subcategories.length, "module")} · ${plural(entryCount, "feature")} · ${plural(skillCount, "skill recording")}`
      : `${plural(category.subcategories.length, "area")} · ${plural(entryCount, "process", "processes")}`;

  return (
    <PageShell user={user}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          category.kind === "SOFTWARE"
            ? { label: "Software", href: "/browse/software" }
            : { label: "Departments", href: "/browse/departments" },
          { label: category.name },
        ]}
      />
      <div className="mt-8">
        <h1 className="text-page-title text-ink">{category.name}</h1>
        <p className="mt-3 text-sm text-ink-muted">{countsLine}</p>
        {category.description ? (
          <p className="mt-4 max-w-2xl text-sm text-ink-muted">{category.description}</p>
        ) : null}
      </div>

      {category.subcategories.length === 0 ? (
        <p className="mt-10 text-sm text-ink-muted">
          No {words.sub}s yet — add them in taxonomy.
        </p>
      ) : (
        <RowList className="mt-10">
          {category.subcategories.map((sub) => (
            <RowLink
              key={sub.id}
              href={`/c/${category.slug}/${sub.slug}`}
              trailing={
                <span className="text-meta">
                  {sub._count.entries === 0
                    ? `No ${words.entryPlural} yet`
                    : plural(sub._count.entries, words.entry, words.entryPlural)}
                </span>
              }
            >
              <span className="flex min-w-0 flex-col py-0.5">
                <span className="truncate font-medium text-ink">{sub.name}</span>
                {sub.description ? (
                  <span className="truncate text-meta text-ink-faint">
                    {sub.description}
                  </span>
                ) : null}
              </span>
            </RowLink>
          ))}
        </RowList>
      )}
    </PageShell>
  );
}
