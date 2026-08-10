"use client";

import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Link2,
  ListChecks,
  ListOrdered,
  Plus,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { plural } from "@/lib/format";
import {
  addBlock,
  addDocumentBlock,
  removeBlock,
  updateBlock,
} from "@/lib/actions/blocks";
import {
  linkPayloadSchema,
  sopPayloadSchema,
  videoPayloadSchema,
  workflowPayloadSchema,
  type DocumentPayload,
  type LinkPayload,
  type SopPayload,
  type VideoPayload,
  type WorkflowPayload,
} from "@/lib/schemas/blocks";

/*
 * Blocks inside an open section: existing blocks as compact rows, then the
 * quiet "Add to this section" chip row. Every section offers every type.
 * The workflow/SOP hints are the step-2 review decision — the two overlap
 * in contributors' heads, and the hint is what prevents misuse.
 */

export type BlockType = "DOCUMENT" | "WORKFLOW" | "VIDEO" | "SOP" | "LINK" | "FILE";

export type EditorBlock = { id: string; type: BlockType; payload: unknown };

type AddableType = "VIDEO" | "WORKFLOW" | "SOP" | "LINK";
type EditableType = AddableType;

type Chip = {
  type: AddableType | "DOCUMENT";
  label: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  hint: string;
};

const CHIPS: Chip[] = [
  { type: "VIDEO", label: "Video", icon: Video, hint: "Embed a recording by URL" },
  {
    type: "WORKFLOW",
    label: "Workflow",
    icon: ListOrdered,
    hint: "The order of operations: what happens first, then next",
  },
  {
    type: "SOP",
    label: "SOP",
    icon: ListChecks,
    hint: "The gate criteria: what must be true before proceeding",
  },
  { type: "DOCUMENT", label: "Document", icon: FileText, hint: "Upload a file" },
  { type: "LINK", label: "Link", icon: Link2, hint: "Reference an external page" },
];

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

function newId(): string {
  return crypto.randomUUID();
}

export function SectionBlocks({
  sectionId,
  blocks,
}: {
  sectionId: string;
  blocks: EditorBlock[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<AddableType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const done = () => {
    setAdding(null);
    setEditingId(null);
    router.refresh();
  };

  const upload = async (file: File) => {
    setUploading(true);
    setRowError(null);
    const form = new FormData();
    form.set("sectionId", sectionId);
    form.set("file", file);
    const result = await addDocumentBlock(form);
    setUploading(false);
    if (result.ok) router.refresh();
    else setRowError(result.error);
  };

  const remove = async (block: EditorBlock) => {
    setRowError(null);
    const result = await removeBlock({ id: block.id });
    if (result.ok) router.refresh();
    else setRowError(result.error);
  };

  return (
    <div className="mt-4">
      {blocks.length > 0 ? (
        <div className="flex flex-col">
          {blocks.map((block) =>
            editingId === block.id ? (
              <BlockForm
                key={block.id}
                type={block.type as EditableType}
                initial={block.payload}
                onCancel={() => setEditingId(null)}
                onSave={async (payload) => {
                  const result = await updateBlock({
                    id: block.id,
                    type: block.type as EditableType,
                    payload,
                  });
                  if (result.ok) done();
                  return result;
                }}
              />
            ) : (
              <BlockRow
                key={block.id}
                block={block}
                onEdit={
                  block.type === "DOCUMENT" || block.type === "FILE"
                    ? null
                    : () => setEditingId(block.id)
                }
                onRemove={() => remove(block)}
              />
            ),
          )}
        </div>
      ) : null}

      {uploading ? (
        <p className="mt-2 text-meta text-ink-faint" role="status">
          Uploading…
        </p>
      ) : null}
      {rowError ? <p className="mt-2 text-meta text-danger">{rowError}</p> : null}

      {adding ? (
        <BlockForm
          type={adding}
          initial={null}
          onCancel={() => setAdding(null)}
          onSave={async (payload) => {
            const result = await addBlock({ sectionId, type: adding, payload });
            if (result.ok) done();
            return result;
          }}
        />
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-meta text-ink-faint">Add to this section</span>
          {CHIPS.map(({ type, label, icon: Icon, hint }) => (
            <button
              key={type}
              type="button"
              title={hint}
              onClick={() => {
                setRowError(null);
                if (type === "DOCUMENT") fileInput.current?.click();
                else setAdding(type);
              }}
              className="inline-flex items-center gap-1 rounded-control text-meta text-ink-muted transition-colors hover:text-accent"
            >
              <Icon size={13} aria-hidden />
              {label}
            </button>
          ))}
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            aria-label="Upload a document"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
      )}
    </div>
  );
}

function BlockRow({
  block,
  onEdit,
  onRemove,
}: {
  block: EditorBlock;
  onEdit: (() => void) | null;
  onRemove: () => void;
}) {
  let Icon: Chip["icon"] = FileText;
  let title = "";
  let meta = "";
  let href: string | null = null;

  switch (block.type) {
    case "VIDEO": {
      const p = block.payload as VideoPayload;
      Icon = Video;
      title = p.title;
      meta = hostname(p.url);
      break;
    }
    case "WORKFLOW": {
      const p = block.payload as WorkflowPayload;
      Icon = ListOrdered;
      title = "Workflow";
      meta = plural(p.steps?.length ?? 0, "step");
      break;
    }
    case "SOP": {
      const p = block.payload as SopPayload;
      Icon = ListChecks;
      title = "SOP";
      meta = plural(p.items?.length ?? 0, "criterion", "criteria");
      break;
    }
    case "LINK": {
      const p = block.payload as LinkPayload;
      Icon = Link2;
      title = p.title;
      meta = hostname(p.url);
      href = p.url;
      break;
    }
    case "DOCUMENT":
    case "FILE": {
      const p = block.payload as DocumentPayload;
      Icon = FileText;
      title = p.filename;
      meta = formatBytes(p.sizeBytes);
      href = `/api/files/${encodeURIComponent(p.fileId)}`;
      break;
    }
  }

  const titleClass =
    "min-w-0 flex-1 truncate rounded-control text-left text-sm text-ink transition-colors";

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon size={15} className="shrink-0 text-ink-faint" aria-hidden />
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          title="Edit this block"
          className={`${titleClass} hover:text-accent`}
        >
          {title}
        </button>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className={`${titleClass} hover:text-accent`}
        >
          {title}
        </a>
      ) : (
        <span className={titleClass}>{title}</span>
      )}
      {meta ? <span className="shrink-0 text-meta text-ink-faint">{meta}</span> : null}
      <button
        type="button"
        aria-label={`Remove ${title}`}
        onClick={onRemove}
        className="shrink-0 rounded-control text-ink-faint transition-colors hover:text-danger"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* One form component per family; `initial` null means creating. */
function BlockForm({
  type,
  initial,
  onCancel,
  onSave,
}: {
  type: EditableType;
  initial: unknown;
  onCancel: () => void;
  onSave: (payload: unknown) => Promise<{ ok: boolean }>;
}) {
  if (type === "WORKFLOW") {
    return (
      <WorkflowForm
        initial={initial as WorkflowPayload | null}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }
  if (type === "SOP") {
    return (
      <SopForm
        initial={initial as SopPayload | null}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }
  return (
    <UrlForm
      type={type}
      initial={initial as (LinkPayload & Partial<VideoPayload>) | null}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

function FormShell({
  hint,
  error,
  busy,
  saveLabel,
  onSave,
  onCancel,
  children,
}: {
  hint: string;
  error: string | null;
  busy: boolean;
  saveLabel: string;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 border-l-2 border-hairline-strong pl-4">
      <p className="text-meta text-ink-faint">{hint}</p>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
      {error ? <p className="mt-2 text-meta text-danger">{error}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : saveLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function UrlForm({
  type,
  initial,
  onCancel,
  onSave,
}: {
  type: "LINK" | "VIDEO";
  initial: (LinkPayload & Partial<VideoPayload>) | null;
  onCancel: () => void;
  onSave: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(
    (initial as LinkPayload | null)?.description ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const schema = type === "LINK" ? linkPayloadSchema : videoPayloadSchema;
    const payload =
      type === "LINK" ? { url, title, description } : { url, title };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSave(parsed.data);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
  };

  return (
    <FormShell
      hint={
        type === "LINK"
          ? "Reference an external page"
          : "Embed a recording by URL"
      }
      error={error}
      busy={busy}
      saveLabel={initial ? "Save" : type === "LINK" ? "Add link" : "Add video"}
      onSave={save}
      onCancel={onCancel}
    >
      <Input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        aria-label="URL"
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        aria-label="Title"
      />
      {type === "LINK" ? (
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's there (optional)"
          aria-label="Description"
        />
      ) : null}
    </FormShell>
  );
}

type StepDraft = {
  id: string;
  label: string;
  description: string;
  durationHint: string;
};

function WorkflowForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: WorkflowPayload | null;
  onCancel: () => void;
  onSave: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [steps, setSteps] = useState<StepDraft[]>(
    initial?.steps.map((step) => ({
      id: step.id,
      label: step.label,
      description: step.description ?? "",
      durationHint: step.durationHint ?? "",
    })) ?? [{ id: newId(), label: "", description: "", durationHint: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, changes: Partial<StepDraft>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  const save = async () => {
    const parsed = workflowPayloadSchema.safeParse({
      steps: steps.map(({ id, label, description, durationHint }) => ({
        id,
        label,
        description,
        ...(durationHint.trim() ? { durationHint } : {}),
      })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSave(parsed.data);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
  };

  return (
    <FormShell
      hint="Workflow — the order of operations: what happens first, then next"
      error={error}
      busy={busy}
      saveLabel={initial ? "Save" : "Add workflow"}
      onSave={save}
      onCancel={onCancel}
    >
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-2">
          <span className="mt-1.5 w-5 shrink-0 text-right text-meta text-ink-faint">
            {index + 1}.
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Input
              autoFocus={index === steps.length - 1 && step.label === ""}
              value={step.label}
              onChange={(e) => patch(step.id, { label: e.target.value })}
              placeholder="What happens"
              aria-label={`Step ${index + 1} label`}
            />
            <Input
              value={step.description}
              onChange={(e) => patch(step.id, { description: e.target.value })}
              placeholder="Detail (optional)"
              aria-label={`Step ${index + 1} description`}
            />
          </div>
          <Input
            value={step.durationHint}
            onChange={(e) => patch(step.id, { durationHint: e.target.value })}
            placeholder="takes…"
            aria-label={`Step ${index + 1} duration`}
            className="w-24 shrink-0"
          />
          <button
            type="button"
            aria-label={`Remove step ${index + 1}`}
            disabled={steps.length === 1}
            onClick={() => setSteps((prev) => prev.filter((s) => s.id !== step.id))}
            className="mt-1.5 shrink-0 rounded-control text-ink-faint transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setSteps((prev) => [
            ...prev,
            { id: newId(), label: "", description: "", durationHint: "" },
          ])
        }
        className="inline-flex items-center gap-0.5 self-start rounded-control text-meta text-ink-faint transition-colors hover:text-accent"
      >
        <Plus size={12} aria-hidden />
        Add step
      </button>
    </FormShell>
  );
}

type ItemDraft = { id: string; text: string };

function SopForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: SopPayload | null;
  onCancel: () => void;
  onSave: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [items, setItems] = useState<ItemDraft[]>(
    initial?.items.map((item) => ({ id: item.id, text: item.text })) ?? [
      { id: newId(), text: "" },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = sopPayloadSchema.safeParse({
      items: items.map(({ id, text }) => ({ id, text, required: true })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSave(parsed.data);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
  };

  return (
    <FormShell
      hint="SOP — the gate criteria: what must be true before proceeding"
      error={error}
      busy={busy}
      saveLabel={initial ? "Save" : "Add SOP"}
      onSave={save}
      onCancel={onCancel}
    >
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <Input
            autoFocus={index === items.length - 1 && item.text === ""}
            value={item.text}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)),
              )
            }
            placeholder="What must be true"
            aria-label={`Criterion ${index + 1}`}
          />
          <button
            type="button"
            aria-label={`Remove criterion ${index + 1}`}
            disabled={items.length === 1}
            onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
            className="shrink-0 rounded-control text-ink-faint transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { id: newId(), text: "" }])}
        className="inline-flex items-center gap-0.5 self-start rounded-control text-meta text-ink-faint transition-colors hover:text-accent"
      >
        <Plus size={12} aria-hidden />
        Add criterion
      </button>
    </FormShell>
  );
}
