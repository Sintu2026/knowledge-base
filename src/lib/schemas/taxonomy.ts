import { z } from "zod";

// Shared by the admin UI and the server actions — parse on both sides.

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name the category").max(80),
  kind: z.enum(["PROCESS", "SOFTWARE"]),
  description: z.string().trim().max(300).default(""),
});

export const subcategoryCreateSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, "Name it").max(80),
  description: z.string().trim().max(300).default(""),
});

export const renameSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "A name is required").max(80),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const archiveSubcategorySchema = z.object({
  id: z.string().min(1),
  // Required only when the subcategory still has entries.
  moveToSubcategoryId: z.string().min(1).optional(),
});

/*
 * Inline destination creation from the editor's picker: either a new
 * module/area under an existing category, or a whole new category — which
 * needs a first module, because entries live at the subcategory level.
 */
export const destinationCreateSchema = z.discriminatedUnion("level", [
  z.object({
    level: z.literal("subcategory"),
    categoryId: z.string().min(1),
    name: z.string().trim().min(1, "Name it first.").max(80),
  }),
  z.object({
    level: z.literal("category"),
    kind: z.enum(["PROCESS", "SOFTWARE"]),
    name: z.string().trim().min(1, "Name it first.").max(80),
    subName: z.string().trim().min(1, "Name the first module or area.").max(80),
  }),
]);

export const idSchema = z.object({ id: z.string().min(1) });

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type SubcategoryCreateInput = z.infer<typeof subcategoryCreateSchema>;
