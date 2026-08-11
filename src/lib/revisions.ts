import { db } from "@/lib/db";

/*
 * Revision writing (§2: every change writes a Revision with an author).
 * Autosave fires every 800ms, so raw per-write revisions would be noise:
 * consecutive edits by the same author within the window coalesce into
 * one revision whose snapshot is the state at the end of the burst —
 * history then reads as "what each person's session changed". Marked
 * events (publish, revert, delete, restore) never coalesce.
 *
 * Scope decision: snapshots cover the prose layer — title, summary, tags
 * and section bodies. Blocks and skills stay out: their payloads carry
 * fileIds whose files are removed with the block, so "restoring" them
 * would resurrect broken references. Their changes are attributed by the
 * edit revisions around them, not diffed.
 */

export type RevisionEvent = "edit" | "publish" | "revert" | "delete" | "restore";

export type RevisionSnapshot = {
  title: string;
  summary: string;
  status: string;
  tags: string[];
  sections: { kind: string; body: string }[];
  event: RevisionEvent;
  note?: string;
};

const COALESCE_MS = 30 * 60 * 1000;

export async function buildSnapshot(
  entryId: string,
  event: RevisionEvent,
  note?: string,
): Promise<RevisionSnapshot | null> {
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: {
      sections: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });
  if (!entry) return null;
  return {
    title: entry.title,
    summary: entry.summary,
    status: entry.status,
    tags: entry.tags.map((t) => t.tag.label),
    sections: entry.sections.map((s) => ({ kind: s.kind, body: s.body })),
    event,
    ...(note ? { note } : {}),
  };
}

export async function recordRevision(
  entryId: string,
  authorId: string,
  event: RevisionEvent = "edit",
  note?: string,
): Promise<void> {
  const snapshot = await buildSnapshot(entryId, event, note);
  if (!snapshot) return;

  if (event === "edit") {
    const latest = await db.revision.findFirst({
      where: { entryId },
      orderBy: { createdAt: "desc" },
    });
    const latestEvent = (latest?.snapshot as { event?: string } | null)?.event;
    // Only coalesce into another plain edit — seeded/publish/revert
    // revisions are checkpoints and must keep their exact snapshots.
    if (
      latest &&
      latest.authorId === authorId &&
      latestEvent === "edit" &&
      Date.now() - latest.createdAt.getTime() < COALESCE_MS
    ) {
      await db.revision.update({
        where: { id: latest.id },
        data: { snapshot, createdAt: new Date() },
      });
      return;
    }
  }

  await db.revision.create({ data: { entryId, authorId, snapshot } });
}
