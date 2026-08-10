import { z } from "zod";

/*
 * Block payloads — the discriminated union behind Block.payload (Json).
 * Every write goes through these schemas; readers can trust the shapes.
 * DOCUMENT/FILE blocks are created through the FormData upload action, so
 * the JSON create/update unions cover only the four inline-editable types.
 */

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Every step needs a label").max(200),
  description: z.string().trim().max(1000).default(""),
  durationHint: z.string().trim().max(60).optional(),
});

export const workflowPayloadSchema = z.object({
  steps: z.array(workflowStepSchema).min(1, "Add at least one step").max(50),
});

export const sopItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, "Every item needs text").max(500),
  required: z.boolean().default(true),
});

export const sopPayloadSchema = z.object({
  items: z.array(sopItemSchema).min(1, "Add at least one item").max(50),
});

export const linkPayloadSchema = z.object({
  url: z.url("That doesn't look like a URL").max(2000),
  title: z.string().trim().min(1, "Give the link a title").max(200),
  description: z.string().trim().max(500).default(""),
});

export const videoPayloadSchema = z.object({
  url: z.url("That doesn't look like a URL").max(2000),
  title: z.string().trim().min(1, "Give the video a title").max(200),
});

export const documentPayloadSchema = z.object({
  fileId: z.string().min(1),
  filename: z.string().min(1).max(200),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().nonnegative(),
});

export type WorkflowPayload = z.infer<typeof workflowPayloadSchema>;
export type SopPayload = z.infer<typeof sopPayloadSchema>;
export type LinkPayload = z.infer<typeof linkPayloadSchema>;
export type VideoPayload = z.infer<typeof videoPayloadSchema>;
export type DocumentPayload = z.infer<typeof documentPayloadSchema>;

export const blockCreateSchema = z.discriminatedUnion("type", [
  z.object({ sectionId: z.string().min(1), type: z.literal("WORKFLOW"), payload: workflowPayloadSchema }),
  z.object({ sectionId: z.string().min(1), type: z.literal("SOP"), payload: sopPayloadSchema }),
  z.object({ sectionId: z.string().min(1), type: z.literal("LINK"), payload: linkPayloadSchema }),
  z.object({ sectionId: z.string().min(1), type: z.literal("VIDEO"), payload: videoPayloadSchema }),
]);

export const blockUpdateSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("WORKFLOW"), payload: workflowPayloadSchema }),
  z.object({ id: z.string().min(1), type: z.literal("SOP"), payload: sopPayloadSchema }),
  z.object({ id: z.string().min(1), type: z.literal("LINK"), payload: linkPayloadSchema }),
  z.object({ id: z.string().min(1), type: z.literal("VIDEO"), payload: videoPayloadSchema }),
]);

export const blockRemoveSchema = z.object({ id: z.string().min(1) });
