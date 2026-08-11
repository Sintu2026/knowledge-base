"use server";

import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { notifySuggestionAdded } from "@/lib/notifications";
import { commentAddSchema, commentResolveSchema } from "@/lib/schemas/entry";
import type { EntryActionResult } from "@/lib/actions/entries";

/*
 * "Suggest an edit" on the read view (§8.4): a Comment the owner sees on
 * the page, resolvable in place once handled.
 */

export async function addComment(input: unknown): Promise<EntryActionResult> {
  const user = await getCurrentUser();
  if (!canEdit(user) || !user) return { ok: false, error: "Sign in to suggest an edit." };
  const parsed = commentAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const entry = await db.entry.findUnique({
    where: { id: parsed.data.entryId },
    include: { owner: true },
  });
  if (!entry || entry.deletedAt) {
    return { ok: false, error: "This entry no longer exists." };
  }

  await db.comment.create({
    data: {
      entryId: entry.id,
      authorId: user.id,
      body: parsed.data.body,
    },
  });
  await notifySuggestionAdded({
    entryId: entry.id,
    entryTitle: entry.title,
    ownerEmail: entry.owner.email,
    authorName: user.name,
  });
  return { ok: true };
}

// Open access: anyone signed in can mark a suggestion handled — the row
// stays in the database, it just leaves the page.
export async function resolveComment(input: unknown): Promise<EntryActionResult> {
  const user = await getCurrentUser();
  if (!canEdit(user)) return { ok: false, error: "Sign in to make changes." };
  const parsed = commentResolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Refresh and try again." };
  const comment = await db.comment.findUnique({ where: { id: parsed.data.id } });
  if (!comment) return { ok: true }; // already gone
  await db.comment.update({
    where: { id: comment.id },
    data: { resolved: true },
  });
  return { ok: true };
}
