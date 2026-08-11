import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plural } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { HistoryView, type HistoryRevision } from "@/components/entry/HistoryView";
import type { RevisionSnapshot } from "@/lib/revisions";

export const metadata = { title: "History — Knowledge base" };

// §7: /entry/[id]/history — revisions and diffs.
export default async function EntryHistoryPage(
  props: PageProps<"/entry/[id]/history">,
) {
  const [{ id }, user] = await Promise.all([props.params, getCurrentUser()]);

  const entry = await db.entry.findUnique({
    where: { id },
    include: {
      category: true,
      subcategory: true,
      revisions: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!entry || entry.deletedAt) notFound();

  const revisions: HistoryRevision[] = entry.revisions.map((revision) => {
    const snapshot = revision.snapshot as Partial<RevisionSnapshot>;
    return {
      id: revision.id,
      authorName: revision.author.name,
      createdAt: revision.createdAt.toISOString(),
      event: typeof snapshot.event === "string" ? snapshot.event : null,
      note: typeof snapshot.note === "string" ? snapshot.note : null,
      title: typeof snapshot.title === "string" ? snapshot.title : "",
      summary: typeof snapshot.summary === "string" ? snapshot.summary : "",
      sections: Array.isArray(snapshot.sections)
        ? snapshot.sections
            .filter(
              (s): s is { kind: string; body: string } =>
                !!s && typeof s.kind === "string" && typeof s.body === "string",
            )
            .map((s) => ({ kind: s.kind, body: s.body }))
        : [],
    };
  });

  return (
    <PageShell user={user}>
      <Breadcrumbs
        items={[
          { label: "Browse", href: "/" },
          { label: entry.category.name, href: `/c/${entry.category.slug}` },
          {
            label: entry.subcategory.name,
            href: `/c/${entry.category.slug}/${entry.subcategory.slug}`,
          },
          { label: entry.title || "Untitled", href: `/entry/${entry.id}` },
          { label: "History" },
        ]}
      />
      <div className="mt-8">
        <h1 className="text-page-title text-ink">History</h1>
        <p className="mt-3 text-sm text-ink-muted">
          {entry.title || "Untitled"} —{" "}
          {plural(revisions.length, "recorded version")}. Every change is
          attributable, and any version can be restored.
        </p>
      </div>
      <HistoryView
        entryId={entry.id}
        template={entry.template}
        revisions={revisions}
      />
    </PageShell>
  );
}
