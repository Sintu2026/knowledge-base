"use server";

import { Prisma } from "../../generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/access";
import { db } from "@/lib/db";
import { deleteFile, saveFile } from "@/lib/storage";
import { transcribeVideo } from "@/lib/transcribe";
import { parseChapterLines, parseTranscriptText } from "@/lib/timecode";
import {
  skillRemoveSchema,
  skillReorderSchema,
  skillSaveSchema,
  skillTitleSchema,
} from "@/lib/schemas/skills";
import type { EntryActionResult } from "@/lib/actions/entries";

/*
 * Skill mutations. The Skill search trigger keeps SearchDoc current on
 * insert and on title/transcript/chapters updates; deletes cascade the doc
 * away through the FK.
 */

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_POSTER_BYTES = 2 * 1024 * 1024;

function fail(error: string): EntryActionResult {
  return { ok: false, error };
}

async function editor() {
  const user = await getCurrentUser();
  return canEdit(user) ? user : null;
}

async function liveEntry(entryId: string) {
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: { id: true, deletedAt: true },
  });
  return entry && !entry.deletedAt ? entry : null;
}

function ownedFile(fileId: string | null): fileId is string {
  return Boolean(fileId && !fileId.startsWith("seed-"));
}

type ParsedSave = ReturnType<typeof skillSaveSchema.parse>;

// Shared by the JSON path (URL videos) and the FormData path (uploads).
async function persistSkill(
  data: ParsedSave,
  upload: { videoFileId: string; posterFileId: string | null } | null,
): Promise<EntryActionResult> {
  if (!(await liveEntry(data.entryId))) return fail("This entry no longer exists.");

  const existing = data.id
    ? await db.skill.findUnique({ where: { id: data.id } })
    : null;
  if (data.id && (!existing || existing.entryId !== data.entryId)) {
    return fail("This recording no longer exists.");
  }

  const chapterParse = parseChapterLines(data.chaptersText);
  if (!chapterParse.ok) return fail(chapterParse.error);

  let { transcript, segments } = parseTranscriptText(data.transcriptText);

  // Where is the video coming from?
  const videoUrl = upload ? null : data.videoUrl || existing?.videoUrl || null;
  const videoFileId = upload ? upload.videoFileId : data.videoUrl ? null : (existing?.videoFileId ?? null);
  if (!videoUrl && !videoFileId) {
    return fail("Add a recording — upload a video or paste its URL.");
  }

  if (data.sopBlockId) {
    const sop = await db.block.findUnique({
      where: { id: data.sopBlockId },
      include: { section: { select: { entryId: true } } },
    });
    if (!sop || sop.type !== "SOP" || sop.section.entryId !== data.entryId) {
      return fail("That SOP no longer exists on this entry.");
    }
    const taken = await db.skill.findFirst({
      where: { sopBlockId: data.sopBlockId, ...(data.id ? { id: { not: data.id } } : {}) },
      select: { title: true },
    });
    if (taken) {
      return fail(`That SOP is already the written fallback for "${taken.title}".`);
    }
  }

  // A fresh upload with no pasted transcript goes through the
  // transcription seam; today it returns null and the paste field remains
  // the path (lib/transcribe.ts).
  if (upload && !transcript) {
    const auto = await transcribeVideo(upload.videoFileId);
    if (auto) {
      transcript = auto.transcript;
      segments = auto.segments;
    }
  }

  const fields = {
    title: data.title,
    videoUrl,
    videoFileId,
    durationSeconds: data.durationSeconds ?? existing?.durationSeconds ?? null,
    posterFileId: upload
      ? upload.posterFileId
      : data.videoUrl && existing?.videoUrl !== data.videoUrl
        ? null // URL changed — the old poster no longer matches
        : (existing?.posterFileId ?? null),
    transcript,
    // The form round-trips existing content, so a save is a full overwrite:
    // a plain-text paste over a segmented transcript drops the stale
    // timings rather than keeping wrong jump targets. Json? clears via
    // DbNull in Prisma 7.
    transcriptSegments: segments ?? Prisma.DbNull,
    chapters:
      chapterParse.chapters.length > 0 ? chapterParse.chapters : Prisma.DbNull,
    sopBlockId: data.sopBlockId ?? null,
  };

  let id: string;
  if (existing) {
    await db.skill.update({ where: { id: existing.id }, data: fields });
    id = existing.id;
    // Replaced media: remove files nothing references any more.
    if (existing.videoFileId !== fields.videoFileId && ownedFile(existing.videoFileId)) {
      await deleteFile(existing.videoFileId);
    }
    if (existing.posterFileId !== fields.posterFileId && ownedFile(existing.posterFileId)) {
      await deleteFile(existing.posterFileId);
    }
  } else {
    const last = await db.skill.findFirst({
      where: { entryId: data.entryId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const skill = await db.skill.create({
      data: { entryId: data.entryId, order: (last?.order ?? -1) + 1, ...fields },
    });
    id = skill.id;
  }
  return { ok: true, id };
}

// URL-sourced (or media-unchanged) saves.
export async function saveSkill(input: unknown): Promise<EntryActionResult> {
  if (!(await editor())) return fail("Sign in to make changes.");
  const parsed = skillSaveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  return persistSkill(parsed.data, null);
}

// Upload-sourced saves: the same fields as strings, plus the video and an
// optional client-captured poster frame.
export async function saveSkillUpload(
  formData: FormData,
): Promise<EntryActionResult> {
  if (!(await editor())) return fail("Sign in to make changes.");

  const video = formData.get("video");
  if (!(video instanceof File) || video.size === 0) {
    return fail("Choose a video file to upload.");
  }
  if (video.size > MAX_VIDEO_BYTES) {
    return fail("Keep recordings under 200 MB — a skill is a short recording of one thing.");
  }

  const duration = formData.get("durationSeconds");
  const parsed = skillSaveSchema.safeParse({
    id: formData.get("id") || undefined,
    entryId: formData.get("entryId"),
    title: formData.get("title"),
    videoUrl: "",
    durationSeconds:
      typeof duration === "string" && duration ? Math.round(Number(duration)) : null,
    chaptersText: formData.get("chaptersText") ?? "",
    transcriptText: formData.get("transcriptText") ?? "",
    sopBlockId: formData.get("sopBlockId") || null,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const videoFileId = await saveFile(Buffer.from(await video.arrayBuffer()), video.name);

  let posterFileId: string | null = null;
  const poster = formData.get("poster");
  if (poster instanceof File && poster.size > 0 && poster.size <= MAX_POSTER_BYTES) {
    posterFileId = await saveFile(Buffer.from(await poster.arrayBuffer()), poster.name);
  }

  const result = await persistSkill(parsed.data, { videoFileId, posterFileId });
  if (!result.ok) {
    // The row never landed — don't strand the upload on disk.
    await deleteFile(videoFileId);
    if (posterFileId) await deleteFile(posterFileId);
  }
  return result;
}

// Inline rename from the skills list row.
export async function updateSkillTitle(input: unknown): Promise<EntryActionResult> {
  if (!(await editor())) return fail("Sign in to make changes.");
  const parsed = skillTitleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const skill = await db.skill.findUnique({ where: { id: parsed.data.id } });
  if (!skill) return fail("This recording no longer exists.");
  await db.skill.update({
    where: { id: skill.id },
    data: { title: parsed.data.title },
  });
  return { ok: true };
}

export async function removeSkill(input: unknown): Promise<EntryActionResult> {
  if (!(await editor())) return fail("Sign in to make changes.");
  const parsed = skillRemoveSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const skill = await db.skill.findUnique({ where: { id: parsed.data.id } });
  if (!skill) return { ok: true }; // already gone

  await db.skill.delete({ where: { id: skill.id } });
  if (ownedFile(skill.videoFileId)) await deleteFile(skill.videoFileId);
  if (ownedFile(skill.posterFileId)) await deleteFile(skill.posterFileId);
  return { ok: true };
}

export async function reorderSkills(input: unknown): Promise<EntryActionResult> {
  if (!(await editor())) return fail("Sign in to make changes.");
  const parsed = skillReorderSchema.safeParse(input);
  if (!parsed.success) return fail("Refresh and try again.");

  const skills = await db.skill.findMany({
    where: { entryId: parsed.data.entryId },
    select: { id: true },
  });
  const current = new Set(skills.map((s) => s.id));
  const next = parsed.data.ids;
  if (next.length !== current.size || next.some((id) => !current.has(id))) {
    return fail("The list changed underneath you — refresh and try again.");
  }

  await db.$transaction(
    next.map((id, order) => db.skill.update({ where: { id }, data: { order } })),
  );
  return { ok: true };
}
