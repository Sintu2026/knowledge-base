import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canDeleteEntry } from "@/lib/access";
import { db } from "@/lib/db";
import { plural, sectionLabel } from "@/lib/format";
import { EntryEditor, type EditorEntry } from "@/components/editor/EntryEditor";

export const metadata = { title: "Edit — Knowledge base" };

export default async function EntryEditPage(props: PageProps<"/entry/[id]/edit">) {
  const [{ id }, user] = await Promise.all([props.params, getCurrentUser()]);

  const entry = await db.entry.findUnique({
    where: { id },
    include: {
      owner: true,
      tags: { include: { tag: true } },
      assignments: { include: { user: true }, orderBy: { role: "asc" } },
      sections: {
        orderBy: { order: "asc" },
        include: { blocks: { orderBy: { order: "asc" } } },
      },
      skills: { orderBy: { order: "asc" } },
    },
  });
  if (!entry || entry.deletedAt) notFound();

  const categories = await db.category.findMany({
    where: { archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      subcategories: { where: { archivedAt: null }, orderBy: { order: "asc" } },
    },
  });
  const destinations = categories.flatMap((category) =>
    category.subcategories.map((sub) => ({
      value: sub.id,
      label: sub.name,
      group: category.name,
    })),
  );

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const editorEntry: EditorEntry = {
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    template: entry.template,
    status: entry.status,
    subcategoryId: entry.subcategoryId,
    reviewIntervalDays: entry.reviewIntervalDays,
    owner: { name: entry.owner.name },
    tags: entry.tags.map((t) => ({ id: t.tag.id, label: t.tag.label })),
    assignments: entry.assignments.map((a) => ({
      id: a.id,
      role: a.role,
      userId: a.userId,
      userName: a.user.name,
    })),
    sections: entry.sections.map((s) => ({
      id: s.id,
      kind: s.kind,
      body: s.body,
      blocks: s.blocks.map((b) => ({ id: b.id, type: b.type, payload: b.payload })),
    })),
    skills: entry.skills.map((sk) => ({
      id: sk.id,
      title: sk.title,
      videoUrl: sk.videoUrl,
      videoFileId: sk.videoFileId,
      durationSeconds: sk.durationSeconds,
      posterFileId: sk.posterFileId,
      transcript: sk.transcript,
      transcriptSegments: sk.transcriptSegments,
      chapters: sk.chapters,
      sopBlockId: sk.sopBlockId,
    })),
    // SOP blocks anywhere on the entry can be a skill's written fallback.
    sopBlocks: entry.sections.flatMap((s) =>
      s.blocks
        .filter((b) => b.type === "SOP")
        .map((b, i, all) => {
          const items = (b.payload as { items?: unknown[] }).items?.length ?? 0;
          const where = sectionLabel(entry.template, s.kind);
          const nth = all.length > 1 ? ` ${i + 1}` : "";
          return {
            id: b.id,
            label: `SOP${nth} in ${where} — ${plural(items, "criterion", "criteria")}`,
          };
        }),
    ),
  };

  return (
    <div className="flex min-h-full flex-col">
      <EntryEditor
        entry={editorEntry}
        destinations={destinations}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        users={users}
        canDelete={canDeleteEntry(user, entry)}
        // The editor works fully without a key — assist actions simply
        // don't render, and the actions re-check server-side.
        assistAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
