"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useDragOrder } from "@/lib/use-drag-order";
import {
  asChapters,
  asSegments,
  chaptersToLines,
  parseChapterLines,
  transcriptToLines,
} from "@/lib/timecode";
import {
  removeSkill,
  reorderSkills,
  saveSkill,
  saveSkillUpload,
  updateSkillTitle,
} from "@/lib/actions/skills";

/*
 * The HOW section of a FEATURE entry: an ordered list of skill recordings
 * instead of block chips (§8.3). Rows are numbered with a drag handle,
 * thumbnail, inline title, and duration; "+ Add a skill recording" opens
 * the full skill form. Screen recordings are made in whatever tool the
 * recorder already uses (§11) — this uploads or links them.
 */

export type EditorSkill = {
  id: string;
  title: string;
  videoUrl: string | null;
  videoFileId: string | null;
  durationSeconds: number | null;
  posterFileId: string | null;
  transcript: string | null;
  transcriptSegments: unknown;
  chapters: unknown;
  sopBlockId: string | null;
};

export type SopOption = { id: string; label: string };

export function SkillsEditor({
  entryId,
  skills,
  sopOptions,
}: {
  entryId: string;
  skills: EditorSkill[];
  sopOptions: SopOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const drag = useDragOrder(
    skills.map((skill) => skill.id),
    (ids) => {
      void reorderSkills({ entryId, ids }).then((result) => {
        if (!result.ok) setRowError(result.error);
        router.refresh();
      });
    },
  );

  const done = () => {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  };

  return (
    <div className="mt-4">
      {drag.order.length > 0 ? (
        <div className="flex flex-col">
          {drag.order.map((id, index) => {
            const skill = byId.get(id);
            if (!skill) return null;
            return editingId === id ? (
              <SkillForm
                key={id}
                entryId={entryId}
                skill={skill}
                sopOptions={sopOptions}
                onCancel={() => setEditingId(null)}
                onDone={done}
              />
            ) : (
              <SkillRow
                key={id}
                skill={skill}
                index={index}
                drag={drag}
                onEdit={() => setEditingId(id)}
                onRemove={() => {
                  setRowError(null);
                  void removeSkill({ id }).then((result) => {
                    if (!result.ok) setRowError(result.error);
                    router.refresh();
                  });
                }}
              />
            );
          })}
        </div>
      ) : null}
      {rowError ? <p className="mt-2 text-meta text-danger">{rowError}</p> : null}

      {adding ? (
        <SkillForm
          entryId={entryId}
          skill={null}
          sopOptions={sopOptions}
          onCancel={() => setAdding(false)}
          onDone={done}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 inline-flex items-center gap-1 rounded-control text-meta text-ink-muted transition-colors hover:text-accent"
        >
          <Plus size={13} aria-hidden />
          Add a skill recording
        </button>
      )}
    </div>
  );
}

type Drag = ReturnType<typeof useDragOrder>;

function SkillRow({
  skill,
  index,
  drag,
  onEdit,
  onRemove,
}: {
  skill: EditorSkill;
  index: number;
  drag: Drag;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => drag.onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        drag.onDragOver(index);
      }}
      onDragEnd={drag.onDragEnd}
      className="flex items-center gap-2.5 py-1.5"
    >
      <button
        type="button"
        aria-label={`Reorder ${skill.title} — arrow keys move it`}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            drag.nudge(index, -1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            drag.nudge(index, 1);
          }
        }}
        className="cursor-grab rounded-control text-ink-faint transition-colors hover:text-ink"
      >
        <GripVertical size={14} />
      </button>
      <span className="w-4 shrink-0 text-right text-meta text-ink-faint">
        {index + 1}
      </span>
      <SkillThumb posterFileId={skill.posterFileId} title={skill.title} />
      <TitleInput skillId={skill.id} title={skill.title} />
      {skill.durationSeconds ? (
        <span className="shrink-0 text-meta text-ink-faint">
          {formatDuration(skill.durationSeconds)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-control text-meta text-ink-muted transition-colors hover:text-accent"
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Remove ${skill.title}`}
        onClick={onRemove}
        className="shrink-0 rounded-control text-ink-faint transition-colors hover:text-danger"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function SkillThumb({
  posterFileId,
  title,
}: {
  posterFileId: string | null;
  title: string;
}) {
  return posterFileId ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local thumb, no optimizer needed
    <img
      src={`/api/files/${encodeURIComponent(posterFileId)}`}
      alt={`${title} thumbnail`}
      className="h-8 w-14 shrink-0 rounded-control bg-sunken object-cover"
    />
  ) : (
    <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-control bg-sunken">
      <Video size={14} className="text-ink-faint" aria-hidden />
    </span>
  );
}

// Inline rename straight from the row; commits on blur or Enter.
function TitleInput({ skillId, title }: { skillId: string; title: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(title);
  const [prev, setPrev] = useState(title);
  if (prev !== title) {
    setPrev(title);
    setDraft(title);
  }

  const commit = () => {
    const next = draft.trim();
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    void updateSkillTitle({ id: skillId, title: next }).then(() => router.refresh());
  };

  return (
    <Input
      variant="bare"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label={`Title of recording ${title}`}
      className="min-w-0 flex-1 text-sm"
    />
  );
}

/*
 * Best-effort media probing, all client-side: duration from metadata (with
 * the Chrome MediaRecorder Infinity workaround) and a poster frame off a
 * canvas. Failure of either just means no duration / no thumbnail.
 */
async function probeVideoFile(
  file: File,
): Promise<{ duration: number | null; poster: Blob | null }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("unreadable"));
      };
    });

    if (!Number.isFinite(video.duration)) {
      // MediaRecorder webms report Infinity until forced to the end.
      video.currentTime = Number.MAX_SAFE_INTEGER;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        video.ontimeupdate = () => {
          clearTimeout(timer);
          video.ontimeupdate = null;
          resolve();
        };
      });
    }
    const duration = Number.isFinite(video.duration)
      ? Math.max(1, Math.round(video.duration))
      : null;

    let poster: Blob | null = null;
    try {
      video.currentTime = Math.min(0.5, (duration ?? 1) / 4);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      const canvas = document.createElement("canvas");
      const width = 480;
      const height = Math.max(
        1,
        Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * width),
      );
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
      poster = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.7),
      );
    } catch {
      poster = null;
    }
    return { duration, poster };
  } catch {
    return { duration: null, poster: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Duration of a pasted URL, if its metadata loads; never blocks a save.
async function probeVideoUrl(url: string): Promise<number | null> {
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 5000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("unreadable"));
      };
    });
    return Number.isFinite(video.duration)
      ? Math.max(1, Math.round(video.duration))
      : null;
  } catch {
    return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[15px] text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function SkillForm({
  entryId,
  skill,
  sopOptions,
  onCancel,
  onDone,
}: {
  entryId: string;
  skill: EditorSkill | null;
  sopOptions: SopOption[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [source, setSource] = useState<"upload" | "url">(
    skill?.videoUrl ? "url" : "upload",
  );
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(skill?.videoUrl ?? "");
  const [title, setTitle] = useState(skill?.title ?? "");
  const [chaptersText, setChaptersText] = useState(
    chaptersToLines(asChapters(skill?.chapters)),
  );
  const [transcriptText, setTranscriptText] = useState(
    transcriptToLines(skill?.transcript ?? null, asSegments(skill?.transcriptSegments)),
  );
  const [sopBlockId, setSopBlockId] = useState(skill?.sopBlockId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) {
      setError("Give the recording a title.");
      return;
    }
    const chapterCheck = parseChapterLines(chaptersText);
    if (!chapterCheck.ok) {
      setError(chapterCheck.error);
      return;
    }
    if (!skill && source === "upload" && !file) {
      setError("Choose a video file to upload.");
      return;
    }
    if (source === "url" && !url.trim() && !skill?.videoFileId) {
      setError("Paste the video's URL.");
      return;
    }

    setBusy(true);
    setError(null);
    let result;
    if (source === "upload" && file) {
      const probe = await probeVideoFile(file);
      const form = new FormData();
      if (skill) form.set("id", skill.id);
      form.set("entryId", entryId);
      form.set("title", title);
      form.set("chaptersText", chaptersText);
      form.set("transcriptText", transcriptText);
      form.set("sopBlockId", sopBlockId);
      if (probe.duration) form.set("durationSeconds", String(probe.duration));
      form.set("video", file);
      if (probe.poster) {
        form.set("poster", new File([probe.poster], "poster.jpg", { type: "image/jpeg" }));
      }
      result = await saveSkillUpload(form);
    } else {
      const duration =
        source === "url" && url.trim() && url.trim() !== skill?.videoUrl
          ? await probeVideoUrl(url.trim())
          : undefined;
      result = await saveSkill({
        id: skill?.id,
        entryId,
        title,
        videoUrl: source === "url" ? url.trim() : "",
        durationSeconds: duration,
        chaptersText,
        transcriptText,
        sopBlockId: sopBlockId || null,
      });
    }
    setBusy(false);
    if (result.ok) onDone();
    else setError(result.error);
  };

  const sourceButton = (value: "upload" | "url", label: string) => (
    <button
      type="button"
      aria-pressed={source === value}
      onClick={() => setSource(value)}
      className={cn(
        "rounded-control text-sm transition-colors",
        source === value ? "font-medium text-ink" : "text-ink-faint hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-3 border-l-2 border-hairline-strong pl-4">
      <p className="text-meta text-ink-faint">
        One skill per recording — a short screen capture of one thing being done
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {sourceButton("upload", "Upload")}
          {sourceButton("url", "Video URL")}
        </div>
        {source === "upload" ? (
          <div>
            <input
              type="file"
              accept="video/*"
              aria-label="Video file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border file:border-hairline file:bg-surface file:px-2.5 file:py-1 file:text-sm file:text-ink"
            />
            {skill?.videoFileId && !file ? (
              <p className="mt-1 text-meta text-ink-faint">
                Keeping the current recording — choose a file to replace it.
              </p>
            ) : null}
          </div>
        ) : (
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… (a direct video link)"
            aria-label="Video URL"
          />
        )}
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What this recording shows"
          />
        </Field>
        <Field label="Chapters — one per line, as timestamp — label">
          <Textarea
            autoGrow
            value={chaptersText}
            onChange={(e) => setChaptersText(e.target.value)}
            placeholder={"0:00 — Import from template\n0:38 — Anchor the start date"}
            className="min-h-12"
          />
        </Field>
        <Field label="Transcript — lines like “0:12 Open the job…” become search jump targets">
          <Textarea
            autoGrow
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Paste the transcript, or leave empty"
            className="min-h-12"
          />
        </Field>
        {sopOptions.length > 0 ? (
          <Field label="SOP — the written fallback for this recording">
            <Select
              value={sopBlockId}
              onChange={(e) => setSopBlockId(e.target.value)}
              className="w-72"
            >
              <option value="">No SOP attached</option>
              {sopOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-meta text-danger">{error}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={save}>
          {busy
            ? source === "upload" && file
              ? "Uploading…"
              : "Saving…"
            : skill
              ? "Save"
              : "Add recording"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
