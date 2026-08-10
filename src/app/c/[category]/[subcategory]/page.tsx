import { notFound } from "next/navigation";
import { Video } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewOverdue, plural, vocab } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RowLink, RowList } from "@/components/ui/Row";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeFilled, SectionBars } from "@/components/entry/SectionBars";

export async function generateMetadata(props: PageProps<"/c/[category]/[subcategory]">) {
  const { subcategory, category } = await props.params;
  const row = await db.subcategory.findFirst({
    where: { slug: subcategory, category: { slug: category } },
  });
  return { title: row ? `${row.name} — Knowledge base` : "Knowledge base" };
}

// The only level where individual entries appear (progressive disclosure).
export default async function SubcategoryPage(
  props: PageProps<"/c/[category]/[subcategory]">,
) {
  const [{ category: catSlug, subcategory: subSlug }, user] = await Promise.all([
    props.params,
    getCurrentUser(),
  ]);

  const sub = await db.subcategory.findFirst({
    where: {
      slug: subSlug,
      archivedAt: null,
      category: { slug: catSlug, archivedAt: null },
    },
    include: {
      category: true,
      entries: {
        where: { status: { not: "archived" }, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          difficulty: true,
          reviewedAt: true,
          reviewIntervalDays: true,
          createdAt: true,
          sections: {
            orderBy: { order: "asc" },
            select: { kind: true, body: true, blocks: { select: { type: true } } },
          },
          _count: { select: { skills: true } },
        },
      },
    },
  });
  if (!sub) notFound();

  const words = vocab(sub.category.kind);
  const skillCount = await db.skill.count({
    where: {
      entry: { subcategoryId: sub.id, status: { not: "archived" }, deletedAt: null },
    },
  });

  return (
    <PageShell user={user}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          sub.category.kind === "SOFTWARE"
            ? { label: "Software", href: "/browse/software" }
            : { label: "Departments", href: "/browse/departments" },
          { label: sub.category.name, href: `/c/${sub.category.slug}` },
          { label: sub.name },
        ]}
      />
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-ink">{sub.name}</h1>
          <p className="mt-3 text-sm text-ink-muted">
            {plural(sub.entries.length, words.entry, words.entryPlural)}
            {skillCount > 0 ? ` · ${plural(skillCount, "skill recording")}` : ""}
          </p>
          {sub.description ? (
            <p className="mt-4 max-w-2xl text-sm text-ink-muted">{sub.description}</p>
          ) : null}
        </div>
        <LinkButton href={`/new?subcategory=${sub.id}`} variant="primary">
          Add a {words.entry}
        </LinkButton>
      </div>

      <div className="mt-10">
        {sub.entries.length === 0 ? (
          <EmptyState
            title={`Nothing in ${sub.name} yet`}
            description={`Add the first ${words.entry} — whatever the team keeps re-explaining about it.`}
            action={
              <LinkButton href={`/new?subcategory=${sub.id}`} variant="primary">
                Add the first one
              </LinkButton>
            }
          />
        ) : (
          <RowList>
            {sub.entries.map((entry) => (
              <RowLink
                key={entry.id}
                href={`/entry/${entry.id}`}
                trailing={
                  <>
                    {entry._count.skills > 0 ? (
                      <span className="inline-flex items-center gap-1 text-meta">
                        <Video size={14} aria-hidden />
                        {entry._count.skills}
                      </span>
                    ) : null}
                    {entry.difficulty ? (
                      <span className="text-meta">
                        {entry.difficulty[0] + entry.difficulty.slice(1).toLowerCase()}
                      </span>
                    ) : null}
                    {entry.status === "draft" ? <Badge>Draft</Badge> : null}
                    {isReviewOverdue(entry) ? (
                      <Badge variant="warning">Review overdue</Badge>
                    ) : null}
                  </>
                }
              >
                <span className="flex min-w-0 flex-col gap-1.5 py-1">
                  <span className="truncate text-ink">{entry.title || "Untitled"}</span>
                  <SectionBars
                    filled={computeFilled(entry.sections, entry._count.skills)}
                  />
                </span>
              </RowLink>
            ))}
          </RowList>
        )}
      </div>
    </PageShell>
  );
}
