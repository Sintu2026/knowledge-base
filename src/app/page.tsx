import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewOverdue } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { BrowseFilters } from "@/components/entry/BrowseFilters";
import { EntryCard, type EntryCardData } from "@/components/entry/EntryCard";

const SECTION_ORDER = ["WHAT", "WHY", "HOW", "WHO", "WHEN"] as const;

export default async function HomePage(props: PageProps<"/">) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUser()]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : null;
  const wantsRecording = sp.rec === "1";
  const wantsReview = sp.review === "1";
  const mine = sp.owner === "me";

  const categories = await db.category.findMany({
    where: { archivedAt: null },
    orderBy: { order: "asc" },
    select: { slug: true, name: true },
  });

  const entries = await db.entry.findMany({
    where: {
      status: { not: "archived" },
      category: { archivedAt: null, ...(cat ? { slug: cat } : {}) },
      subcategory: { archivedAt: null },
      ...(mine && user ? { ownerId: user.id } : {}),
      ...(wantsRecording ? { skills: { some: {} } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      sections: {
        orderBy: { order: "asc" },
        select: { kind: true, body: true, blocks: { select: { type: true } } },
      },
      _count: { select: { skills: true } },
    },
  });

  const cards: EntryCardData[] = entries
    .filter((entry) => !wantsReview || isReviewOverdue(entry))
    .map((entry) => {
      const blocks = entry.sections.flatMap((s) => s.blocks);
      return {
        id: entry.id,
        title: entry.title,
        summary: entry.summary,
        draft: entry.status === "draft",
        overdue: isReviewOverdue(entry),
        breadcrumb: `${entry.category.name} › ${entry.subcategory.name}`,
        filled: SECTION_ORDER.map((kind) => {
          const section = entry.sections.find((s) => s.kind === kind);
          if (!section) return false;
          const hasSkills = kind === "HOW" && entry._count.skills > 0;
          return section.body.trim() !== "" || section.blocks.length > 0 || hasSkills;
        }),
        skillCount: entry._count.skills,
        workflowCount: blocks.filter((b) => b.type === "WORKFLOW").length,
        documentCount: blocks.filter((b) => b.type === "DOCUMENT" || b.type === "FILE").length,
      };
    });

  const databaseEmpty =
    categories.length === 0 &&
    cards.length === 0 &&
    !cat &&
    !wantsRecording &&
    !wantsReview &&
    !mine;

  return (
    <PageShell user={user}>
      {/* The search slot: full-width input plus the page's one accent action.
          This row must not move or resize between browse and results states. */}
      <div className="flex items-center gap-3">
        <SearchBar />
        <LinkButton href="/new" variant="primary" className="shrink-0">
          Add knowledge
        </LinkButton>
      </div>

      {databaseEmpty ? (
        <div className="flex flex-1 flex-col justify-center py-16">
          <EmptyState
            title="Add what your team keeps re-explaining"
            description="Every entry answers the same five questions — what, why, how, who, when — so the next person unblocks themselves in under a minute."
            className="p-14"
            action={
              <span className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/new" variant="secondary">
                  Add knowledge
                </LinkButton>
                <LinkButton href="/admin/taxonomy" variant="secondary">
                  Set up the first category
                </LinkButton>
              </span>
            }
          />
        </div>
      ) : (
        <>
          {q ? (
            // Results render in place — same page, same input position (§6).
            <SearchResults />
          ) : (
            <>
              <div className="mt-5">
                <BrowseFilters categories={categories} />
              </div>
              {mine ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Entries you own{cards.length ? ` — ${cards.length}` : ""}.
                </p>
              ) : null}
              {cards.length === 0 ? (
                <p className="mt-8 text-sm text-ink-muted">
                  Nothing matches these filters.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                  {cards.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </>
          )}
          <div className="mt-8">
            <EmptyState
              title="Add what your team keeps re-explaining"
              action={
                <LinkButton href="/new" variant="secondary">
                  Add knowledge
                </LinkButton>
              }
            />
          </div>
        </>
      )}
    </PageShell>
  );
}
