"use server";

import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { recordRevision, type RevisionSnapshot } from "@/lib/revisions";
import { revisionRestoreSchema } from "@/lib/schemas/entry";
import type { EntryActionResult } from "@/lib/actions/entries";

/*
 * Restoring a revision is §2's reversibility made concrete: the prose
 * layer (title, summary, section bodies) is written back from the
 * snapshot, and the restore itself becomes a new revision — history only
 * ever grows, so a restore can itself be undone.
 */

export async function restoreRevision(input: unknown): Promise<EntryActionResult> {
  const user = await getCurrentUser();
  if (!canEdit(user) || !user) return { ok: false, error: "Sign in to make changes." };
  const parsed = revisionRestoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Refresh and try again." };

  const revision = await db.revision.findUnique({
    where: { id: parsed.data.revisionId },
    include: { entry: { include: { sections: true } } },
  });
  if (!revision || revision.entryId !== parsed.data.entryId) {
    return { ok: false, error: "That version no longer exists." };
  }
  if (revision.entry.deletedAt) {
    return { ok: false, error: "This entry no longer exists." };
  }

  const snapshot = revision.snapshot as Partial<RevisionSnapshot>;
  const sections = Array.isArray(snapshot.sections) ? snapshot.sections : [];

  await db.$transaction([
    db.entry.update({
      where: { id: revision.entryId },
      data: {
        title: typeof snapshot.title === "string" ? snapshot.title : undefined,
        summary: typeof snapshot.summary === "string" ? snapshot.summary : undefined,
      },
    }),
    ...revision.entry.sections.flatMap((section) => {
      const from = sections.find((s) => s?.kind === section.kind);
      if (!from || typeof from.body !== "string" || from.body === section.body) {
        return [];
      }
      return [
        db.section.update({ where: { id: section.id }, data: { body: from.body } }),
      ];
    }),
  ]);

  await recordRevision(
    revision.entryId,
    user.id,
    "revert",
    `restored the version from ${revision.createdAt.toISOString().slice(0, 10)}`,
  );
  return { ok: true };
}
