"use server";

import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { commentAddSchema } from "@/lib/schemas/entry";
import type { EntryActionResult } from "@/lib/actions/entries";

/*
 * "Suggest an edit" on the read view (§8.4): a Comment the owner sees on
 * the page. Resolving them arrives with step 10's history work.
 */

export async function addComment(input: unknown): Promise<EntryActionResult> {
  const user = await getCurrentUser();
  if (!canEdit(user) || !user) return { ok: false, error: "Sign in to suggest an edit." };
  const parsed = commentAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const entry = await db.entry.findUnique({ where: { id: parsed.data.entryId } });
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
  return { ok: true };
}
