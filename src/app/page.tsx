import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewOverdue, plural } from "@/lib/format";
import { TopBar } from "@/components/layout/TopBar";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RowLink, RowList } from "@/components/ui/Row";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";

/*
 * The landing is search-first and nearly empty: name, one pill input, two
 * quiet browse doors, one counts line. Browsing is progressive disclosure
 * from /browse/* down; entries only ever appear at the subcategory level.
 * With a query, results render in place on this same page.
 */
export default async function HomePage(props: PageProps<"/">) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUser()]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const mine = sp.owner === "me";

  const [categoryCount, entryCount, skillCount] = await Promise.all([
    db.category.count({ where: { archivedAt: null } }),
    db.entry.count({
      where: {
        status: { not: "archived" },
        deletedAt: null,
        category: { archivedAt: null },
      },
    }),
    db.skill.count({
      where: {
        entry: {
          status: { not: "archived" },
          deletedAt: null,
          category: { archivedAt: null },
        },
      },
    }),
  ]);

  const mineEntries = mine
    ? await db.entry.findMany({
        where: { ownerId: user?.id ?? "", status: { not: "archived" }, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          category: { select: { name: true, slug: true } },
          subcategory: { select: { name: true, slug: true } },
        },
      })
    : [];

  const searching = q !== "";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-10 sm:px-8">
        {searching || mine ? (
          <>
            <div className="mx-auto mt-10 w-full max-w-[520px]">
              <SearchBar />
            </div>
            {searching ? (
              <SearchResults />
            ) : (
              <div className="mt-10">
                <h1 className="text-section-head text-ink">Your entries</h1>
                {mineEntries.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-muted">
                    Nothing yet. Whatever you explain most often is the place
                    to start.
                  </p>
                ) : (
                  <RowList className="mt-4">
                    {mineEntries.map((entry) => (
                      <RowLink
                        key={entry.id}
                        href={`/entry/${entry.id}`}
                        trailing={
                          <>
                            {entry.status === "draft" ? <Badge>Draft</Badge> : null}
                            {isReviewOverdue(entry) ? (
                              <Badge variant="warning">Review overdue</Badge>
                            ) : null}
                          </>
                        }
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-ink">{entry.title || "Untitled"}</span>
                          <span className="truncate text-meta text-ink-faint">
                            {entry.category.name} › {entry.subcategory.name}
                          </span>
                        </span>
                      </RowLink>
                    ))}
                  </RowList>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="my-auto flex flex-col items-center gap-8 py-16">
              <h1 className="text-page-title text-ink">Knowledge base</h1>
              <div className="w-full max-w-[520px]">
                <SearchBar />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LinkButton href="/browse/software" variant="secondary">
                  Browse software
                </LinkButton>
                <LinkButton href="/browse/departments" variant="secondary">
                  Browse departments
                </LinkButton>
              </div>
            </div>
            <p className="pt-6 text-center text-meta text-ink-faint">
              {categoryCount === 0 ? (
                <>
                  Empty so far —{" "}
                  <Link href="/admin/taxonomy" className="text-accent">
                    set up the first category
                  </Link>
                </>
              ) : (
                `${plural(categoryCount, "category", "categories")} · ${plural(entryCount, "entry", "entries")} · ${plural(skillCount, "skill recording")}`
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
