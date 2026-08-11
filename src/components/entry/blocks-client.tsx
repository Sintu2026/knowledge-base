"use client";

import { useState } from "react";
import { Play, Video } from "lucide-react";
import { useLocalJson } from "@/lib/use-local-json";
import type { SopPayload, VideoPayload } from "@/lib/schemas/blocks";

/*
 * The two block renderers that need a client: videos expand to an inline
 * player in place, and SOP checklists keep per-viewer state in
 * localStorage with a "3 of 7 done" counter (§8.4). Everything else in a
 * section renders on the server (BlockView).
 */

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function VideoBlock({ payload }: { payload: VideoPayload }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div>
        <video controls autoPlay src={payload.url} className="w-full rounded-card bg-black" />
        <p className="mt-1.5 text-meta text-ink-faint">{payload.title}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group flex w-full items-center gap-2.5 rounded-control py-1 text-left"
    >
      <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-control bg-sunken">
        <Play size={14} className="text-ink-faint transition-colors group-hover:text-accent" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-ink transition-colors group-hover:text-accent">
          {payload.title}
        </span>
        <span className="truncate text-meta text-ink-faint">
          <Video size={11} className="mr-1 inline" aria-hidden />
          {hostname(payload.url)}
        </span>
      </span>
    </button>
  );
}

export function SopChecklist({
  blockId,
  payload,
}: {
  blockId: string;
  payload: SopPayload;
}) {
  // Which item ids this viewer has ticked — theirs alone, never synced.
  const [done, setDone] = useLocalJson<Record<string, true>>(`kb-sop:${blockId}`, {});
  const doneCount = payload.items.filter((item) => done[item.id]).length;

  return (
    <div>
      <p className="text-meta text-ink-faint" role="status">
        {doneCount} of {payload.items.length} done
      </p>
      <ul className="mt-2 flex max-w-2xl flex-col gap-2">
        {payload.items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={Boolean(done[item.id])}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDone((prev) => {
                    const next = { ...prev };
                    if (checked) next[item.id] = true;
                    else delete next[item.id];
                    return next;
                  });
                }}
                className="mt-0.5 size-3.5 shrink-0 accent-accent"
              />
              <span
                className={
                  done[item.id]
                    ? "text-sm text-ink-faint line-through decoration-hairline-strong"
                    : "text-sm text-ink-muted"
                }
              >
                {item.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
