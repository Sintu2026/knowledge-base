import { formatDuration } from "@/lib/format";

/*
 * Timestamp text shared by the skill editor and player. Chapters are typed
 * as `timestamp — label` lines; transcripts pasted with leading timestamps
 * per line gain segments, which is what makes "Jump to 0:52" possible for
 * manual transcripts, not just imported ones.
 */

export type Chapter = { t: number; label: string };
export type TranscriptSegment = { t: number; text: string };

// "1:23" → 83, "01:02:03" → 3723. Null when it isn't a timestamp.
export function parseTimestamp(text: string): number | null {
  const match = text.trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, a, b, c] = match;
  const parts = c === undefined ? [0, Number(a), Number(b)] : [Number(a), Number(b), Number(c)];
  const [h, m, s] = parts;
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

export type ChapterParse =
  | { ok: true; chapters: Chapter[] }
  | { ok: false; error: string };

// One chapter per line: `0:38 — Anchor the start date`. Tolerant about the
// dash (em, en, hyphen) but not about the timestamp.
export function parseChapterLines(text: string): ChapterParse {
  const chapters: Chapter[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^(\S+)\s*[—–-]\s*(.+)$/);
    const t = match ? parseTimestamp(match[1]) : null;
    if (!match || t === null) {
      return {
        ok: false,
        error: `Chapter line ${i + 1} should read like "0:38 — Anchor the start date".`,
      };
    }
    chapters.push({ t, label: match[2].trim() });
  }
  return { ok: true, chapters };
}

export function chaptersToLines(chapters: Chapter[]): string {
  return chapters
    .map((chapter) => `${formatDuration(chapter.t)} — ${chapter.label}`)
    .join("\n");
}

export type TranscriptParse = {
  transcript: string | null;
  segments: TranscriptSegment[] | null;
};

/*
 * A transcript where every line starts with a timestamp ("0:12 Open the
 * job…") becomes segments with timings; anything else is kept as plain
 * text. Mixed input stays plain — half-timed segments would produce wrong
 * jumps, and a wrong jump is worse than none.
 */
export function parseTranscriptText(text: string): TranscriptParse {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { transcript: null, segments: null };

  const segments: TranscriptSegment[] = [];
  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(.*)$/);
    const t = match ? parseTimestamp(match[1]) : null;
    if (t === null || !match || !match[2]) {
      return { transcript: lines.join("\n"), segments: null };
    }
    segments.push({ t, text: match[2] });
  }
  return {
    transcript: segments.map((segment) => segment.text).join(" "),
    segments,
  };
}

export function transcriptToLines(
  transcript: string | null,
  segments: TranscriptSegment[] | null,
): string {
  if (segments && segments.length > 0) {
    return segments
      .map((segment) => `${formatDuration(segment.t)} ${segment.text}`)
      .join("\n");
  }
  return transcript ?? "";
}

// Loose runtime casts for the Json columns — every write path validates,
// so readers only need shape guards.
export function asChapters(value: unknown): Chapter[] {
  return Array.isArray(value)
    ? value.filter(
        (c): c is Chapter =>
          !!c && typeof c === "object" && typeof (c as Chapter).t === "number" &&
          typeof (c as Chapter).label === "string",
      )
    : [];
}

export function asSegments(value: unknown): TranscriptSegment[] {
  return Array.isArray(value)
    ? value.filter(
        (s): s is TranscriptSegment =>
          !!s && typeof s === "object" && typeof (s as TranscriptSegment).t === "number" &&
          typeof (s as TranscriptSegment).text === "string",
      )
    : [];
}
