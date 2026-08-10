"use server";

import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { deleteFile, saveFile } from "@/lib/storage";
import {
  blockCreateSchema,
  blockRemoveSchema,
  blockUpdateSchema,
} from "@/lib/schemas/blocks";
import type { EntryActionResult } from "@/lib/actions/entries";

/*
 * Block mutations. SearchDoc upkeep is the database's job — the Block
 * trigger refreshes the entry's doc on insert, update and delete.
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function fail(error: string): EntryActionResult {
  return { ok: false, error };
}

async function editor() {
  const user = await getCurrentUser();
  return canEdit(user) ? user : null;
}

// A block write is only valid against a live entry.
async function liveSection(sectionId: string) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { entry: { select: { deletedAt: true } } },
  });
  if (!section || section.entry.deletedAt) return null;
  return section;
}

export async function addBlock(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = blockCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const section = await liveSection(parsed.data.sectionId);
  if (!section) return fail("This section no longer exists.");

  const last = await db.block.findFirst({
    where: { sectionId: section.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const block = await db.block.create({
    data: {
      sectionId: section.id,
      type: parsed.data.type,
      order: (last?.order ?? -1) + 1,
      payload: parsed.data.payload,
    },
  });
  return { ok: true, id: block.id };
}

export async function updateBlock(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = blockUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const block = await db.block.findUnique({ where: { id: parsed.data.id } });
  if (!block) return fail("This block no longer exists.");
  if (block.type !== parsed.data.type) return fail("Refresh and try again.");

  await db.block.update({
    where: { id: block.id },
    data: { payload: parsed.data.payload },
  });
  return { ok: true };
}

export async function removeBlock(input: unknown): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");
  const parsed = blockRemoveSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const block = await db.block.findUnique({ where: { id: parsed.data.id } });
  if (!block) return { ok: true }; // already gone

  await db.block.delete({ where: { id: block.id } });

  // Uploaded files go with their block; seed fixtures stay shared.
  if (block.type === "DOCUMENT" || block.type === "FILE") {
    const fileId = (block.payload as { fileId?: string } | null)?.fileId;
    if (fileId && !fileId.startsWith("seed-")) await deleteFile(fileId);
  }
  return { ok: true };
}

// DOCUMENT blocks arrive as multipart form data: sectionId + the file.
export async function addDocumentBlock(
  formData: FormData,
): Promise<EntryActionResult> {
  const user = await editor();
  if (!user) return fail("Sign in to make changes.");

  const sectionId = formData.get("sectionId");
  const file = formData.get("file");
  if (typeof sectionId !== "string" || !(file instanceof File)) {
    return fail("Refresh and try again.");
  }
  if (file.size === 0) return fail("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("Keep uploads under 25 MB — link to large files instead.");
  }

  const section = await liveSection(sectionId);
  if (!section) return fail("This section no longer exists.");

  const fileId = await saveFile(Buffer.from(await file.arrayBuffer()), file.name);
  const last = await db.block.findFirst({
    where: { sectionId: section.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const block = await db.block.create({
    data: {
      sectionId: section.id,
      type: "DOCUMENT",
      order: (last?.order ?? -1) + 1,
      payload: {
        fileId,
        filename: file.name.slice(0, 200),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
    },
  });
  return { ok: true, id: block.id };
}
