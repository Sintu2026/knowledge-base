"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canDelete, canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { plural } from "@/lib/format";
import {
  archiveSubcategorySchema,
  categoryCreateSchema,
  destinationCreateSchema,
  idSchema,
  renameSchema,
  reorderSchema,
  subcategoryCreateSchema,
} from "@/lib/schemas/taxonomy";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function requireEditor(): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!canEdit(user)) return fail("Sign in to make changes.");
  return null;
}

function refresh() {
  // Taxonomy shapes browse, category pages and admin alike.
  revalidatePath("/", "layout");
}

async function uniqueCategorySlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (
      await db.category.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((c) => c.slug),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function createCategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = categoryCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { name, kind, description } = parsed.data;
  const last = await db.category.aggregate({ _max: { order: true } });
  await db.category.create({
    data: {
      name,
      kind,
      description,
      slug: await uniqueCategorySlug(name),
      order: (last._max.order ?? -1) + 1,
    },
  });
  refresh();
  return ok;
}

export async function createSubcategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = subcategoryCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { categoryId, name, description } = parsed.data;
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) return fail("That category no longer exists. Refresh and try again.");

  const base = slugify(name);
  const siblings = await db.subcategory.findMany({
    where: { categoryId },
    select: { slug: true, order: true },
  });
  const taken = new Set(siblings.map((s) => s.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  await db.subcategory.create({
    data: {
      categoryId,
      name,
      description,
      slug,
      order: siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0,
    },
  });
  refresh();
  return ok;
}

export type DestinationResult =
  | { ok: true; subcategoryId: string; categoryKind: "PROCESS" | "SOFTWARE" }
  | { ok: false; error: string };

/*
 * Inline creation from the editor's destination picker (§ post-step-9
 * review): taxonomy admin is for tidying up, never a prerequisite for
 * contributing. Returns the id to select, unlike the admin actions.
 */
export async function createDestination(
  input: unknown,
): Promise<DestinationResult> {
  const denied = await requireEditor();
  if (denied && !denied.ok) return { ok: false, error: denied.error };
  const parsed = destinationCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (parsed.data.level === "subcategory") {
    const { categoryId, name } = parsed.data;
    const category = await db.category.findUnique({ where: { id: categoryId } });
    if (!category || category.archivedAt) {
      return { ok: false, error: "That category is archived or gone. Pick another." };
    }
    const base = slugify(name);
    const siblings = await db.subcategory.findMany({
      where: { categoryId },
      select: { slug: true, order: true },
    });
    const taken = new Set(siblings.map((s) => s.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const sub = await db.subcategory.create({
      data: {
        categoryId,
        name,
        slug,
        order: siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0,
      },
    });
    refresh();
    return { ok: true, subcategoryId: sub.id, categoryKind: category.kind };
  }

  const { name, kind, subName } = parsed.data;
  const last = await db.category.aggregate({ _max: { order: true } });
  const slug = await uniqueCategorySlug(name);
  const sub = await db.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { name, kind, slug, order: (last._max.order ?? -1) + 1 },
    });
    return tx.subcategory.create({
      data: {
        categoryId: category.id,
        name: subName,
        slug: slugify(subName),
        order: 0,
      },
    });
  });
  refresh();
  return { ok: true, subcategoryId: sub.id, categoryKind: kind };
}

export async function renameCategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.category.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });
  refresh();
  return ok;
}

export async function renameSubcategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.subcategory.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });
  refresh();
  return ok;
}

export async function reorderCategories(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return fail("Reorder failed. Refresh and try again.");
  await db.$transaction(
    parsed.data.ids.map((id, order) =>
      db.category.update({ where: { id }, data: { order } }),
    ),
  );
  refresh();
  return ok;
}

export async function reorderSubcategories(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return fail("Reorder failed. Refresh and try again.");
  await db.$transaction(
    parsed.data.ids.map((id, order) =>
      db.subcategory.update({ where: { id }, data: { order } }),
    ),
  );
  refresh();
  return ok;
}

export async function archiveSubcategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = archiveSubcategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const sub = await db.subcategory.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { entries: true } }, category: true },
  });
  if (!sub) return fail("That level no longer exists. Refresh and try again.");

  const entryCount = sub._count.entries;
  if (entryCount > 0) {
    const targetId = parsed.data.moveToSubcategoryId;
    if (!targetId) {
      return fail(
        `${sub.name} has ${plural(entryCount, "entry", "entries")}. Choose where they move first.`,
      );
    }
    if (targetId === sub.id) return fail("Pick a different destination — entries can't move into the level being archived.");
    const target = await db.subcategory.findUnique({ where: { id: targetId } });
    if (!target || target.archivedAt) {
      return fail("That destination is archived or gone. Pick another.");
    }
    await db.$transaction([
      db.entry.updateMany({
        where: { subcategoryId: sub.id },
        data: { subcategoryId: target.id, categoryId: target.categoryId },
      }),
      db.subcategory.update({
        where: { id: sub.id },
        data: { archivedAt: new Date() },
      }),
    ]);
  } else {
    await db.subcategory.update({
      where: { id: sub.id },
      data: { archivedAt: new Date() },
    });
  }
  refresh();
  return ok;
}

export async function archiveCategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Archive failed. Refresh and try again.");

  const category = await db.category.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { entries: true } } },
  });
  if (!category) return fail("That category no longer exists. Refresh and try again.");
  if (category._count.entries > 0) {
    return fail(
      `${category.name} still has ${plural(category._count.entries, "entry", "entries")}. ` +
        "Archive each module and choose where its entries move, then archive the category.",
    );
  }
  await db.category.update({
    where: { id: category.id },
    data: { archivedAt: new Date() },
  });
  refresh();
  return ok;
}

export async function restoreCategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Restore failed. Refresh and try again.");
  await db.category.update({
    where: { id: parsed.data.id },
    data: { archivedAt: null },
  });
  refresh();
  return ok;
}

export async function restoreSubcategory(input: unknown): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return denied;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Restore failed. Refresh and try again.");
  await db.subcategory.update({
    where: { id: parsed.data.id },
    data: { archivedAt: null },
  });
  refresh();
  return ok;
}

export async function deleteSubcategory(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canDelete(user)) return fail("Sign in to make changes.");
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Delete failed. Refresh and try again.");

  const sub = await db.subcategory.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { entries: true } } },
  });
  if (!sub) return ok; // already gone
  if (sub._count.entries > 0) {
    return fail(
      `${sub.name} has ${plural(sub._count.entries, "entry", "entries")}. Move them first — archiving does that in one step.`,
    );
  }
  await db.subcategory.delete({ where: { id: sub.id } });
  refresh();
  return ok;
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canDelete(user)) return fail("Sign in to make changes.");
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Delete failed. Refresh and try again.");

  const category = await db.category.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { entries: true } } },
  });
  if (!category) return ok;
  if (category._count.entries > 0) {
    return fail(
      `${category.name} has ${plural(category._count.entries, "entry", "entries")}. Move them out of its modules first.`,
    );
  }
  await db.category.delete({ where: { id: category.id } });
  refresh();
  return ok;
}
