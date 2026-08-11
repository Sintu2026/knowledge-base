import { z } from "zod";

// Shared by the editor UI and the server actions — parse on both sides.

export const entryCreateSchema = z.object({
  template: z.enum(["PROCESS", "FEATURE"]),
  subcategoryId: z.string().min(1, "Pick where this lives"),
  title: z.string().trim().max(200).default(""),
});

export const entryMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(500).optional(),
  subcategoryId: z.string().min(1).optional(),
});

export const sectionBodySchema = z.object({
  id: z.string().min(1),
  body: z.string().max(20000),
});

export const entryIdSchema = z.object({ id: z.string().min(1) });

export const tagAddSchema = z.object({
  entryId: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, "Type the tag first")
    .max(40, "Keep tags under 40 characters")
    .transform((s) => s.toLowerCase()),
});

export const tagRemoveSchema = z.object({
  entryId: z.string().min(1),
  tagId: z.string().min(1),
});

export const assignmentSetSchema = z.object({
  entryId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["OWNER", "APPROVER", "CONTACT"]),
});

export const assignmentRemoveSchema = z.object({ id: z.string().min(1) });

export const ownerSetSchema = z.object({
  entryId: z.string().min(1),
  userId: z.string().min(1),
});

export const revisionRestoreSchema = z.object({
  entryId: z.string().min(1),
  revisionId: z.string().min(1),
});

export const commentResolveSchema = z.object({ id: z.string().min(1) });

export const commentAddSchema = z.object({
  entryId: z.string().min(1),
  body: z.string().trim().min(1, "Write the suggestion first.").max(2000),
});

export const reviewIntervalSchema = z.object({
  entryId: z.string().min(1),
  days: z.number().int().positive().max(3650).nullable(),
});
