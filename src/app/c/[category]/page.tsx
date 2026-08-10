import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewOverdue, plural, vocab } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LinkButton } from "@/components/ui/Button";
import { AddTile, EntryTile } from "@/components/entry/EntryTile";
import { CategoryFilters } from "@/components/entry/CategoryFilters";

export async function generateMetadata(props: PageProps<"/c/[category]">) {
  const { category } = await props.params;
  const row = await db.category.findUnique({ where: { slug: category } });
  return { title: row ? `${row.name} — Knowledge base` : "Knowledge base" };
}

function difficultyLabel(d: string): string {
  return d[0] + d.slice(1).toLowerCase();
}

export default async function CategoryPage(props: PageProps<"/c/[category]">) {
  const [{ category: slug }, sp, user] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);

  const category = await db.category.findFirst({
    where: { slug, archivedAt: null },
    include: {
      subcategories: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        include: {
          entries: {
            where: { status: { not: "archived" } },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              difficulty: true,
              reviewedAt: true,
              reviewIntervalDays: true,
              createdAt: true,
              _count: { select: { skills: true } },
            },
          },
        },
      },
    },
  });
  if (!category) notFound();

  const words = vocab(category.kind);
  const skillCount = await db.skill.count({
    where: { entry: { categoryId: category.id, status: { not: "archived" } } },
  });
  const entryCount = category.subcategories.reduce((n, s) => n + s.entries.length, 0);

  const difficulty = typeof sp.difficulty === "string" ? sp.difficulty : null;
  const wantsRecording = sp.rec === "1";
  const wantsReview = sp.review === "1";
  const filtersActive = Boolean(difficulty) || wantsRecording || wantsReview;

  const matches = (entry: (typeof category.subcategories)[number]["entries"][number]) => {
    if (difficulty && entry.difficulty !== difficulty) return false;
    if (wantsRecording && entry._count.skills === 0) return false;
    if (wantsReview && !isReviewOverdue(entry)) return false;
    return true;
  };

  const countsLine =
    category.kind === "SOFTWARE"
      ? `${plural(category.subcategories.length, "module")} · ${plural(entryCount, "feature")} · ${plural(skillCount, "skill recording")}`
      : `${plural(category.subcategories.length, "area")} · ${plural(entryCount, "process", "processes")}`;

  return (
    <PageShell user={user}>
      <Breadcrumbs items={[{ label: "Browse", href: "/" }, { label: category.name }]} />
      <div className="mt-4">
        <h1 className="text-page-title font-medium">{category.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">{countsLine}</p>
        {category.description ? (
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">{category.description}</p>
        ) : null}
      </div>

      <div className="mt-5">
        <CategoryFilters kind={category.kind} />
      </div>

      <div className="mt-2 divide-y divide-hairline">
        {category.subcategories.map((sub) => {
          const visible = sub.entries.filter(matches);
          return (
            <section key={sub.id} className="py-6">
              <div className="flex items-baseline gap-2">
                <h2 className="text-section-head font-medium">{sub.name}</h2>
                <span className="text-sm text-ink-muted">
                  {plural(sub.entries.length, words.entry, words.entryPlural)}
                </span>
                <LinkButton
                  href={`/c/${category.slug}/${sub.slug}`}
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                >
                  Open {words.sub}
                </LinkButton>
              </div>
              {sub.entries.length === 0 ? (
                <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
                  <span>No {words.entryPlural} yet</span>
                  <LinkButton href={`/new?subcategory=${sub.id}`} variant="ghost" size="sm">
                    Add the first one
                  </LinkButton>
                </div>
              ) : visible.length === 0 && filtersActive ? (
                <p className="mt-3 text-sm text-ink-muted">
                  Nothing in {sub.name} matches the filters.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {visible.map((entry) => (
                    <EntryTile
                      key={entry.id}
                      href={`/entry/${entry.id}`}
                      title={entry.title}
                      meta={[
                        ...(entry._count.skills > 0
                          ? [plural(entry._count.skills, "skill")]
                          : []),
                        ...(entry.difficulty ? [difficultyLabel(entry.difficulty)] : []),
                      ]}
                      draft={entry.status === "draft"}
                      overdue={isReviewOverdue(entry)}
                    />
                  ))}
                  <AddTile
                    href={`/new?subcategory=${sub.id}`}
                    label={`Add a ${words.entry} here`}
                  />
                </div>
              )}
            </section>
          );
        })}
        {category.subcategories.length === 0 ? (
          <p className="py-6 text-sm text-ink-muted">
            No {category.kind === "SOFTWARE" ? "modules" : "areas"} yet — set them up in{" "}
            <LinkButton href="/admin/taxonomy" variant="ghost" size="sm">
              taxonomy
            </LinkButton>
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}
