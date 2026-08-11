import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { SkillsList } from "@/components/entry/SkillsList";

export default async function EntryPage(props: PageProps<"/entry/[id]">) {
  const [{ id }, sp, user] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);

  const entry = await db.entry.findUnique({
    where: { id },
    include: {
      category: true,
      subcategory: true,
      skills: { orderBy: { order: "asc" } },
    },
  });
  // Soft-deleted entries are gone from every reader's perspective; the row
  // survives only for admin-level recovery.
  if (!entry || entry.deletedAt) notFound();

  // Deep link from search: ?skill=<id>&t=<seconds> expands that recording
  // and starts it there (§6).
  const initialSkillId = typeof sp.skill === "string" ? sp.skill : null;
  const t = typeof sp.t === "string" ? Number.parseInt(sp.t, 10) : NaN;
  const initialT = Number.isFinite(t) && t >= 0 ? t : null;

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
          { label: entry.title },
        ]}
      />
      {entry.skills.length > 0 ? (
        <>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-page-title text-ink">{entry.title}</h1>
            <LinkButton href={`/entry/${entry.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
          </div>
          {entry.summary ? (
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">{entry.summary}</p>
          ) : null}
          <div className="mt-10">
            <h2 className="section-label">
              {entry.template === "FEATURE"
                ? sectionLabel(entry.template, "HOW")
                : "Skill recordings"}
            </h2>
            <div className="mt-3">
              <SkillsList
                skills={entry.skills.map((sk) => ({
                  id: sk.id,
                  title: sk.title,
                  videoFileId: sk.videoFileId,
                  videoUrl: sk.videoUrl,
                  durationSeconds: sk.durationSeconds,
                  posterFileId: sk.posterFileId,
                  transcript: sk.transcript,
                  transcriptSegments: sk.transcriptSegments,
                  chapters: sk.chapters,
                }))}
                initialSkillId={initialSkillId}
                initialT={initialT}
              />
            </div>
          </div>
          <p className="mt-12 text-meta text-ink-faint">
            Sections and blocks render here in build step 9.
          </p>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center py-10">
          <EmptyState
            title={entry.title}
            description="The read view arrives in build step 9 — sections, blocks and skill recordings render here."
            action={
              <LinkButton href={`/entry/${entry.id}/edit`} variant="secondary">
                Open the editor
              </LinkButton>
            }
          />
        </div>
      )}
    </PageShell>
  );
}
