import { z } from "zod";

/*
 * Skill editor input. Video comes either as an upload (FormData path — the
 * file itself never passes through these schemas) or as a pasted URL.
 * Chapters and transcript arrive as the text the author typed; the action
 * parses them via lib/timecode before writing JSON.
 */

export const skillSaveSchema = z.object({
  id: z.string().min(1).optional(),
  entryId: z.string().min(1),
  title: z.string().trim().min(1, "Give the recording a title").max(200),
  videoUrl: z
    .union([z.literal(""), z.url("That doesn't look like a video URL")])
    .default(""),
  // Measured client-side from the file or URL metadata; best-effort.
  durationSeconds: z.number().int().positive().max(4 * 3600).nullish(),
  chaptersText: z.string().max(5000).default(""),
  transcriptText: z.string().max(100000).default(""),
  sopBlockId: z.string().min(1).nullish(),
});

export const skillTitleSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Give the recording a title").max(200),
});

export const skillRemoveSchema = z.object({ id: z.string().min(1) });

export const skillReorderSchema = z.object({
  entryId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(200),
});
