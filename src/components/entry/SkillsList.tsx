"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Video } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDuration, plural } from "@/lib/format";
import {
  asChapters,
  asSegments,
  type Chapter,
  type TranscriptSegment,
} from "@/lib/timecode";

/*
 * The skills list on the read page (§8.4): numbered rows with thumbnail,
 * title, duration, chapter count and a per-viewer Watched badge. Playing
 * expands the player in place with its chapter list. A ?skill=&t= deep
 * link — the "Jump to 0:52" from search — scrolls here, expands, and
 * seeks once metadata is in.
 */

export type ReaderSkill = {
  id: string;
  title: string;
  videoFileId: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  posterFileId: string | null;
  transcript: string | null;
  transcriptSegments: unknown;
  chapters: unknown;
};

/*
 * Per-viewer watched state lives in localStorage, read through
 * useSyncExternalStore so the server snapshot is empty (hydration-safe)
 * and same-tab writes re-render via a custom event — the browser's
 * "storage" event only fires in other tabs.
 */
const WATCHED_KEY = "kb-watched";
const WATCHED_EVENT = "kb-watched-change";

function subscribeWatched(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(WATCHED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(WATCHED_EVENT, callback);
  };
}

function watchedSnapshot(): string {
  try {
    return localStorage.getItem(WATCHED_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function markWatchedInStore(id: string) {
  try {
    const parsed = JSON.parse(watchedSnapshot()) as Record<string, true>;
    if (parsed[id]) return;
    parsed[id] = true;
    localStorage.setItem(WATCHED_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new Event(WATCHED_EVENT));
  } catch {
    // Private-mode storage failures just lose the badge.
  }
}

export function SkillsList({
  skills,
  initialSkillId,
  initialT,
}: {
  skills: ReaderSkill[];
  initialSkillId: string | null;
  initialT: number | null;
}) {
  const deepLinked = Boolean(
    initialSkillId && skills.some((skill) => skill.id === initialSkillId),
  );
  const [openId, setOpenId] = useState<string | null>(
    deepLinked ? initialSkillId : null,
  );
  const watchedRaw = useSyncExternalStore(
    subscribeWatched,
    watchedSnapshot,
    () => "{}",
  );
  const watched = useMemo(() => {
    try {
      return JSON.parse(watchedRaw) as Record<string, true>;
    } catch {
      return {} as Record<string, true>;
    }
  }, [watchedRaw]);

  return (
    <ol className="flex flex-col">
      {skills.map((skill, index) => {
        const open = openId === skill.id;
        const chapters = asChapters(skill.chapters);
        return (
          <li key={skill.id} className="border-b border-hairline py-3 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : skill.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 rounded-control text-left"
            >
              <span className="w-4 shrink-0 text-right text-meta text-ink-faint">
                {index + 1}
              </span>
              {skill.posterFileId ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny local thumb
                <img
                  src={`/api/files/${encodeURIComponent(skill.posterFileId)}`}
                  alt=""
                  className="h-10 w-[72px] shrink-0 rounded-control bg-sunken object-cover"
                />
              ) : (
                <span className="flex h-10 w-[72px] shrink-0 items-center justify-center rounded-control bg-sunken">
                  <Video size={16} className="text-ink-faint" aria-hidden />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    "truncate text-sm text-ink transition-colors",
                    open && "font-medium",
                  )}
                >
                  {skill.title}
                </span>
                <span className="text-meta text-ink-faint">
                  {[
                    skill.durationSeconds ? formatDuration(skill.durationSeconds) : null,
                    chapters.length > 0 ? plural(chapters.length, "chapter") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {watched[skill.id] ? <Badge variant="accent">Watched</Badge> : null}
            </button>
            {open ? (
              <SkillPlayer
                skill={skill}
                chapters={chapters}
                initialT={deepLinked && skill.id === initialSkillId ? initialT : null}
                scrollOnMount={deepLinked && skill.id === initialSkillId}
                onWatched={() => markWatchedInStore(skill.id)}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function SkillPlayer({
  skill,
  chapters,
  initialT,
  scrollOnMount,
  onWatched,
}: {
  skill: ReaderSkill;
  chapters: Chapter[];
  initialT: number | null;
  scrollOnMount: boolean;
  onWatched: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reported = useRef(false);

  const src = skill.videoFileId
    ? `/api/files/${encodeURIComponent(skill.videoFileId)}`
    : (skill.videoUrl ?? undefined);
  const segments = asSegments(skill.transcriptSegments);

  // Deep link: bring the skill into view, then seek once the browser
  // knows the media's duration. Play is attempted; when autoplay policy
  // declines, the player sits paused at the right second — which is the
  // promise "Jump to 0:52" actually makes.
  useEffect(() => {
    if (scrollOnMount) {
      container.current?.scrollIntoView({ block: "center" });
    }
    const element = video.current;
    if (!element || initialT === null) return;
    const seek = () => {
      const bound = Number.isFinite(element.duration)
        ? Math.max(0, Math.min(initialT, element.duration - 0.25))
        : initialT;
      element.currentTime = bound;
      void element.play().catch(() => {});
    };
    if (element.readyState >= 1) seek();
    else element.addEventListener("loadedmetadata", seek, { once: true });
    return () => element.removeEventListener("loadedmetadata", seek);
  }, [initialT, scrollOnMount]);

  const seekTo = (t: number) => {
    const element = video.current;
    if (!element) return;
    element.currentTime = t;
    void element.play().catch(() => {});
  };

  return (
    <div ref={container} className="mt-3 pl-7">
      {src ? (
        <video
          ref={video}
          controls
          preload="metadata"
          src={src}
          poster={
            skill.posterFileId
              ? `/api/files/${encodeURIComponent(skill.posterFileId)}`
              : undefined
          }
          onTimeUpdate={(e) => {
            const element = e.currentTarget;
            if (
              !reported.current &&
              Number.isFinite(element.duration) &&
              element.duration > 0 &&
              element.currentTime / element.duration > 0.9
            ) {
              reported.current = true;
              onWatched();
            }
          }}
          onEnded={() => {
            if (!reported.current) {
              reported.current = true;
              onWatched();
            }
          }}
          className="w-full rounded-card bg-black"
        >
          {/* Captions arrive with a transcription service; the transcript
              below is the accessible fallback meanwhile. */}
        </video>
      ) : (
        <p className="text-sm text-ink-muted">No video attached to this skill yet.</p>
      )}

      {chapters.length > 0 ? (
        <ol className="mt-3 flex flex-col gap-1">
          {chapters.map((chapter) => (
            <li key={`${chapter.t}-${chapter.label}`}>
              <button
                type="button"
                onClick={() => seekTo(chapter.t)}
                className="inline-flex items-baseline gap-2 rounded-control text-sm text-ink-muted transition-colors hover:text-accent"
              >
                <span className="font-medium tabular-nums text-accent">
                  {formatDuration(chapter.t)}
                </span>
                {chapter.label}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {skill.transcript ? (
        <details className="mt-3">
          <summary className="cursor-pointer rounded-control text-meta text-ink-faint transition-colors hover:text-ink">
            Transcript
          </summary>
          <TranscriptBody
            transcript={skill.transcript}
            segments={segments}
            onSeek={seekTo}
          />
        </details>
      ) : null}
    </div>
  );
}

function TranscriptBody({
  transcript,
  segments,
  onSeek,
}: {
  transcript: string;
  segments: TranscriptSegment[];
  onSeek: (t: number) => void;
}) {
  if (segments.length === 0) {
    return <p className="mt-2 max-w-2xl text-sm text-ink-muted">{transcript}</p>;
  }
  return (
    <div className="mt-2 flex max-w-2xl flex-col gap-1.5">
      {segments.map((segment) => (
        <p key={`${segment.t}-${segment.text.slice(0, 24)}`} className="text-sm text-ink-muted">
          <button
            type="button"
            onClick={() => onSeek(segment.t)}
            aria-label={`Play from ${formatDuration(segment.t)}`}
            className="mr-2 rounded-control tabular-nums text-accent transition-colors hover:text-accent-hover"
          >
            {formatDuration(segment.t)}
          </button>
          {segment.text}
        </p>
      ))}
    </div>
  );
}
