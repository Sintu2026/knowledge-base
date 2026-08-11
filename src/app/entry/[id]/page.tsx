import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewOverdue, relativeTime, sectionLabel } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { computeFilled } from "@/components/entry/SectionBars";
import { EntryRail } from "@/components/entry/EntryRail";
import { Markdown } from "@/components/entry/Markdown";
import { BlockView, type ReaderBlock } from "@/components/entry/BlockView";
import { SkillsList } from "@/components/entry/SkillsList";
import { ReaderActions } from "@/components/entry/ReaderActions";
import { ResolveCommentButton } from "@/components/entry/ResolveCommentButton";

const KINDS = ["WHAT", "WHY", "HOW", "WHO", "WHEN"] as const;

export async function generateMetadata(props: PageProps<"/entry/[id]">) {
  const { id } = await props.params;
  const entry = await db.entry.findUnique({ where: { id }, select: { title: true } });
  return { title: entry ? `${entry.title} — Knowledge base` : "Knowledge base" };
}

// The read view (§8.4): sticky section rail, markdown bodies, every block
// renderer, and the skills player with its deep links.
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
      owner: true,
      sections: {
        orderBy: { order: "asc" },
        include: { blocks: { orderBy: { order: "asc" } } },
      },
      skills: { orderBy: { order: "asc" } },
      assignments: { include: { user: true }, orderBy: { role: "asc" } },
      comments: {
        where: { resolved: false },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
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

  const filled = computeFilled(entry.sections, entry.skills.length);
  const overdue = isReviewOverdue(entry);
  const reviewedLabel = entry.reviewedAt ? relativeTime(entry.reviewedAt) : null;
  const isFeature = entry.template === "FEATURE";

  // A section renders when it has anything to show; the rail must know,
  // because an anchor to an unrendered section is a dead link.
  const renders = (kind: (typeof KINDS)[number]) => {
    const section = entry.sections.find((s) => s.kind === kind);
    if (!section) return false;
    return (
      section.body.trim() !== "" ||
      section.blocks.length > 0 ||
      (kind === "HOW" && entry.skills.length > 0) ||
      (kind === "WHO" && entry.assignments.length > 0)
    );
  };

  const railSections = KINDS.map((kind, i) => ({
    kind,
    label: sectionLabel(entry.template, kind),
    filled: filled[i],
    rendered: renders(kind),
  }));

  const readerSkills = entry.skills.map((sk) => ({
    id: sk.id,
    title: sk.title,
    videoFileId: sk.videoFileId,
    videoUrl: sk.videoUrl,
    durationSeconds: sk.durationSeconds,
    posterFileId: sk.posterFileId,
    transcript: sk.transcript,
    transcriptSegments: sk.transcriptSegments,
    chapters: sk.chapters,
  }));

  const empty = filled.every((f) => !f);

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
          { label: entry.title || "Untitled" },
        ]}
      />

      <div className="mt-8 min-[900px]:grid min-[900px]:grid-cols-[120px_minmax(0,1fr)] min-[900px]:gap-12">
        <EntryRail
          sections={railSections}
          reviewedLabel={reviewedLabel}
          overdue={overdue}
        />

        <article className="mt-6 min-[900px]:mt-0">
          <h1 className="text-page-title text-ink">{entry.title || "Untitled"}</h1>

          {entry.status === "archived" ? (
            // Archived replaces the metadata line with a full-width banner.
            <p className="mt-4 rounded-card bg-sunken px-4 py-3 text-sm text-ink-muted">
              Archived — kept for reference and reachable by link, but out of
              browse and search. Owner: {entry.owner.name}.
            </p>
          ) : (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-meta text-ink-faint">
              <span>{isFeature ? "Feature" : "Process"}</span>
              {isFeature && entry.difficulty ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {entry.difficulty[0] + entry.difficulty.slice(1).toLowerCase()}
                  </span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span>{entry.owner.name}</span>
              {entry.status === "draft" ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Draft</span>
                </>
              ) : null}
              {reviewedLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span className={overdue ? "text-warning" : undefined}>
                    {overdue ? "Review overdue" : `Reviewed ${reviewedLabel}`}
                  </span>
                </>
              ) : null}
            </p>
          )}
          {entry.summary ? (
            <p className="mt-4 max-w-2xl text-sm text-ink-muted">{entry.summary}</p>
          ) : null}

          {empty ? (
            <div className="mt-10">
              <EmptyState
                title="Nothing here yet"
                description="All five sections are empty — whatever the team keeps re-explaining about this is the place to start."
                action={
                  <LinkButton href={`/entry/${entry.id}/edit`} variant="primary">
                    Write the first section
                  </LinkButton>
                }
              />
            </div>
          ) : (
            <div className="mt-12 flex flex-col gap-12">
              {entry.sections.map((section) => {
                if (!renders(section.kind)) {
                  return null; // empty sections stay in the rail, not the page
                }
                const showSkills =
                  section.kind === "HOW" && entry.skills.length > 0;
                const hasBody = section.body.trim() !== "";
                const assignments =
                  section.kind === "WHO" ? entry.assignments : [];
                return (
                  <section
                    key={section.id}
                    id={`section-${section.kind.toLowerCase()}`}
                    className="scroll-mt-14 min-[900px]:scroll-mt-8"
                  >
                    <h2 className="section-label">
                      {sectionLabel(entry.template, section.kind)}
                    </h2>
                    <div className="mt-3 flex flex-col gap-4">
                      {hasBody ? <Markdown body={section.body} /> : null}
                      {section.blocks.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {section.blocks.map((block) => (
                            <BlockView key={block.id} block={block as ReaderBlock} />
                          ))}
                        </div>
                      ) : null}
                      {showSkills ? (
                        <SkillsList
                          skills={readerSkills}
                          initialSkillId={initialSkillId}
                          initialT={initialT}
                        />
                      ) : null}
                      {assignments.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {assignments.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center gap-2 text-sm text-ink-muted"
                            >
                              <Avatar name={a.user.name} size="sm" />
                              {a.user.name}
                              <span className="text-meta text-ink-faint">
                                {a.role.toLowerCase()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="mt-16">
            <ReaderActions entryId={entry.id} isFeature={isFeature} />
          </div>

          {entry.comments.length > 0 ? (
            <div className="mt-10">
              <h2 className="section-label">Suggestions</h2>
              <ul className="mt-3 flex max-w-2xl flex-col gap-4">
                {entry.comments.map((comment) => (
                  <li key={comment.id} className="flex gap-2.5">
                    <Avatar name={comment.author.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-3 text-meta text-ink-faint">
                        <span>
                          {comment.author.name} · {relativeTime(comment.createdAt)}
                        </span>
                        <ResolveCommentButton commentId={comment.id} />
                      </p>
                      <p className="mt-0.5 text-sm text-ink-muted">{comment.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </div>
    </PageShell>
  );
}
