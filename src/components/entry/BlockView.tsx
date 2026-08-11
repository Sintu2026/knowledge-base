import { Download, FileText, Link2 } from "lucide-react";
import { SopChecklist, VideoBlock } from "@/components/entry/blocks-client";
import type {
  DocumentPayload,
  LinkPayload,
  SopPayload,
  VideoPayload,
  WorkflowPayload,
} from "@/lib/schemas/blocks";

/*
 * Read-view block renderers (§8.4). Server components except where the
 * behaviour needs a client (video expand, SOP checklist). Payloads were
 * validated on write, so readers only cast.
 */

export type ReaderBlock = {
  id: string;
  type: "DOCUMENT" | "WORKFLOW" | "VIDEO" | "SOP" | "LINK" | "FILE";
  payload: unknown;
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BlockView({ block }: { block: ReaderBlock }) {
  switch (block.type) {
    case "DOCUMENT":
    case "FILE": {
      const payload = block.payload as DocumentPayload;
      const href = `/api/files/${encodeURIComponent(payload.fileId)}`;
      const size = formatBytes(payload.sizeBytes);
      return (
        <div className="flex items-center gap-2.5 py-1">
          <FileText size={15} className="shrink-0 text-ink-faint" aria-hidden />
          <a
            href={href}
            target="_blank"
            rel="noopener"
            className="min-w-0 flex-1 truncate rounded-control text-sm text-ink transition-colors hover:text-accent"
          >
            {payload.filename}
          </a>
          {size ? <span className="shrink-0 text-meta text-ink-faint">{size}</span> : null}
          <a
            href={href}
            download={payload.filename}
            aria-label={`Download ${payload.filename}`}
            className="shrink-0 rounded-control text-ink-faint transition-colors hover:text-accent"
          >
            <Download size={14} aria-hidden />
          </a>
        </div>
      );
    }
    case "LINK": {
      const payload = block.payload as LinkPayload;
      return (
        <a
          href={payload.url}
          target="_blank"
          rel="noopener"
          className="group flex flex-col rounded-control py-1"
        >
          <span className="flex items-center gap-2 text-sm text-ink transition-colors group-hover:text-accent">
            <Link2 size={14} className="shrink-0 text-ink-faint" aria-hidden />
            <span className="truncate">{payload.title}</span>
          </span>
          <span className="pl-[22px] text-meta text-ink-faint">
            {hostname(payload.url)}
            {payload.description ? ` — ${payload.description}` : ""}
          </span>
        </a>
      );
    }
    case "WORKFLOW": {
      const payload = block.payload as WorkflowPayload;
      return (
        <ol className="flex max-w-2xl flex-col gap-3">
          {payload.steps.map((step, index) => (
            <li key={step.id} className="flex gap-3">
              <span className="w-5 shrink-0 pt-px text-right text-meta tabular-nums text-ink-faint">
                {index + 1}.
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{step.label}</span>
                  {step.durationHint ? (
                    <span className="shrink-0 text-meta text-ink-faint">
                      {step.durationHint}
                    </span>
                  ) : null}
                </span>
                {step.description ? (
                  <span className="text-sm text-ink-muted">{step.description}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      );
    }
    case "SOP":
      return <SopChecklist blockId={block.id} payload={block.payload as SopPayload} />;
    case "VIDEO":
      return <VideoBlock payload={block.payload as VideoPayload} />;
  }
}
