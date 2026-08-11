import type { TranscriptSegment } from "@/lib/timecode";

/*
 * Transcription seam (§8.3). No service is configured, so uploads return
 * null and the skill editor offers the manual paste field. Wiring a real
 * service (Whisper, Deepgram, …) means implementing this one function:
 * read the video via storage.ts, send it out, map the response to
 * { transcript, segments }.
 */

export type TranscriptionResult = {
  transcript: string;
  segments: TranscriptSegment[] | null;
};

export async function transcribeVideo(
  fileId: string,
): Promise<TranscriptionResult | null> {
  void fileId; // the real implementation reads the video via storage.ts
  return null;
}
