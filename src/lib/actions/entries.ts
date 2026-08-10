"use server";

import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import {
  assignmentRemoveSchema,
  assignmentSetSchema,
  entryCreateSchema,
  entryIdSchema,
  entryMetaSchema,
  reviewIntervalSchema,
  sectionBodySchema,
  tagAddSchema,
  tagRemoveSchema,
} from "@/lib/schemas/entry";

/*
 * Entry mutations. Every page that reads entries renders dynamically (auth
 * makes them per-request), so autosave writes don't need revalidation —
 * the next read re-queries. SearchDoc upkeep is the database's job.
 */

export type EntryActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function fail(error: string): EntryActionResult {
  return { ok: false, error };
}

const SECTION_KINDS = ["WHAT", "WHY", "HOW", "WHO", "WHEN"] as const;

async function editor() {
  const user = await getCurrentUser();
  return canEdit(user) ? user : null;
}

export async function createEntry(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to add knowledge.");
  const parsed = entryCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const sub = await db.subcategory.findUnique({
    where: { id: parsed.data.subcategoryId },
    include: { category: true },
  });
  if (!sub || sub.archivedAt || sub.category.archivedAt) {
    return fail("That destination is archived or gone. Pick another.");
  }

  const entry = await db.entry.create({
    data: {
      title: parsed.data.title,
      template: parsed.data.template,
      categoryId: sub.categoryId,
      subcategoryId: sub.id,
      ownerId: user.id,
      status: "draft",
      // Every entry gets all five section rows immediately, in fixed
      // order. Sections are never deleted, only left empty.
      sections: {
        create: SECTION_KINDS.map((kind, order) => ({ kind, order, body: "" })),
      },
      assignments: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  return { ok: true, id: entry.id };
}

export async function updateEntryMeta(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = entryMetaSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, title, summary, subcategoryId } = parsed.data;

  let categoryId: string | undefined;
  if (subcategoryId) {
    const sub = await db.subcategory.findUnique({ where: { id: subcategoryId } });
    if (!sub || sub.archivedAt) return fail("That destination is archived or gone. Pick another.");
    categoryId = sub.categoryId;
  }
  await db.entry.update({
    where: { id },
    data: { title, summary, subcategoryId, categoryId },
  });
  return { ok: true };
}

export async function updateSectionBody(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = sectionBodySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.section.update({
    where: { id: parsed.data.id },
    data: { body: parsed.data.body },
  });
  return { ok: true };
}

export async function publishEntry(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = entryIdSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const entry = await db.entry.findUnique({
    where: { id: parsed.data.id },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!entry) return fail("This entry no longer exists.");

  // Publishing needs only a title, a destination, and a non-empty What.
  // Everything else can come later and shows as partial (§8.3).
  if (!entry.title.trim()) return fail("Give it a title before publishing.");
  const what = entry.sections.find((s) => s.kind === "WHAT");
  if (!what || !what.body.trim()) {
    return fail("Write the What section before publishing — one paragraph is enough.");
  }

  // Full revision history arrives in step 10; publishing already records
  // an attributable snapshot so open editing stays reversible (§2).
  await db.$transaction([
    db.entry.update({
      where: { id: entry.id },
      data: { status: "published", version: { increment: 1 } },
    }),
    db.revision.create({
      data: {
        entryId: entry.id,
        authorId: user.id,
        snapshot: {
          title: entry.title,
          summary: entry.summary,
          status: "published",
          sections: entry.sections.map((s) => ({ kind: s.kind, body: s.body })),
        },
      },
    }),
  ]);
  return { ok: true };
}

export async function addTag(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = tagAddSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const tag = await db.tag.upsert({
    where: { label: parsed.data.label },
    update: {},
    create: { label: parsed.data.label },
  });
  await db.entryTag.upsert({
    where: { entryId_tagId: { entryId: parsed.data.entryId, tagId: tag.id } },
    update: {},
    create: { entryId: parsed.data.entryId, tagId: tag.id },
  });
  return { ok: true };
}

export async function removeTag(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = tagRemoveSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");
  await db.entryTag.deleteMany({
    where: { entryId: parsed.data.entryId, tagId: parsed.data.tagId },
  });
  return { ok: true };
}

export async function setAssignment(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = assignmentSetSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");
  await db.assignment.upsert({
    where: {
      entryId_userId_role: {
        entryId: parsed.data.entryId,
        userId: parsed.data.userId,
        role: parsed.data.role,
      },
    },
    update: {},
    create: parsed.data,
  });
  return { ok: true };
}

export async function removeAssignment(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = assignmentRemoveSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");
  await db.assignment.deleteMany({ where: { id: parsed.data.id } });
  return { ok: true };
}

export async function setReviewInterval(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = reviewIntervalSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");
  await db.entry.update({
    where: { id: parsed.data.entryId },
    data: {
      reviewIntervalDays: parsed.data.days,
      // Setting a cadence starts the clock now rather than marking the
      // entry instantly overdue.
      ...(parsed.data.days ? { reviewedAt: new Date() } : {}),
    },
  });
  return { ok: true };
}
