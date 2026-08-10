"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { sectionHint, sectionLabel } from "@/lib/format";
import {
  addTag,
  publishEntry,
  removeAssignment,
  removeTag,
  setAssignment,
  setReviewInterval,
  updateEntryMeta,
  updateSectionBody,
} from "@/lib/actions/entries";

type Kind = "WHAT" | "WHY" | "HOW" | "WHO" | "WHEN";
type Template = "PROCESS" | "FEATURE";

export type EditorEntry = {
  id: string;
  title: string;
  summary: string;
  template: Template;
  status: "draft" | "published" | "archived";
  subcategoryId: string;
  reviewIntervalDays: number | null;
  owner: { name: string };
  tags: { id: string; label: string }[];
  assignments: { id: string; role: string; userId: string; userName: string }[];
  sections: { id: string; kind: Kind; body: string }[];
};

type EntryEditorProps = {
  entry: EditorEntry;
  destinations: ComboboxOption[];
  users: { id: string; name: string }[];
};

type SaveState = "idle" | "dirty" | "saving" | "saved";

const AUTOSAVE_MS = 800;

const CADENCES = [
  ["", "No review cadence"],
  ["30", "Review monthly"],
  ["90", "Review quarterly"],
  ["180", "Review twice a year"],
  ["365", "Review yearly"],
] as const;

export function EntryEditor({ entry, destinations, users }: EntryEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [title, setTitle] = useState(entry.title);
  const [summary, setSummary] = useState(entry.summary);
  const [bodies, setBodies] = useState<Record<string, string>>(
    Object.fromEntries(entry.sections.map((s) => [s.id, s.body])),
  );
  const [status, setStatus] = useState(entry.status);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);

  // What the server last acknowledged, to diff against on flush; `latest`
  // mirrors state for the debounced flush closure and is only ever written
  // from event handlers.
  const saved = useRef({ title: entry.title, summary: entry.summary, bodies: { ...Object.fromEntries(entry.sections.map((s) => [s.id, s.body])) } });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: entry.title, summary: entry.summary, bodies: Object.fromEntries(entry.sections.map((s) => [s.id, s.body])) });

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const current = latest.current;
    const jobs: Promise<unknown>[] = [];
    if (
      current.title !== saved.current.title ||
      current.summary !== saved.current.summary
    ) {
      jobs.push(
        updateEntryMeta({ id: entry.id, title: current.title, summary: current.summary }),
      );
    }
    for (const [id, body] of Object.entries(current.bodies)) {
      if (body !== saved.current.bodies[id]) {
        jobs.push(updateSectionBody({ id, body }));
      }
    }
    if (jobs.length === 0) return Promise.resolve();
    setSaveState("saving");
    return Promise.all(jobs).then(() => {
      saved.current = { title: current.title, summary: current.summary, bodies: { ...current.bodies } };
      setSaveState("saved");
    });
  }, [entry.id]);

  // Autosave 800ms after typing stops — a quiet label, never a toast.
  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    setPublishError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        await flush();
      });
    }, AUTOSAVE_MS);
  }, [flush]);

  const publish = useCallback(() => {
    startTransition(async () => {
      await flush();
      const result = await publishEntry({ id: entry.id });
      if (result.ok) {
        setStatus("published");
        setPublishError(null);
        router.refresh();
      } else {
        setPublishError(result.error);
      }
    });
  }, [entry.id, flush, router]);

  // Cmd/Ctrl+S saves, Cmd/Ctrl+Enter publishes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        startTransition(async () => {
          await flush();
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        publish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush, publish]);

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? status === "draft"
          ? "Draft saved"
          : "Saved"
        : saveState === "dirty"
          ? "Unsaved changes"
          : "";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 sm:px-8">
      {/* Header: Back left; save indicator, Save draft, Publish right. */}
      <div className="flex items-center gap-2">
        <Link
          href={`/entry/${entry.id}`}
          className="inline-flex items-center gap-1.5 rounded-control text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Back
        </Link>
        <span className="ml-auto text-meta text-ink-faint" role="status">
          {saveLabel}
        </span>
        <Button
          size="sm"
          onClick={() =>
            startTransition(async () => {
              await flush();
            })
          }
        >
          Save draft
        </Button>
        {status === "draft" ? (
          <Button size="sm" variant="primary" onClick={publish}>
            Publish
          </Button>
        ) : (
          <Badge variant="accent">Published</Badge>
        )}
      </div>
      {publishError ? (
        <p className="mt-3 text-right text-sm text-danger">{publishError}</p>
      ) : null}

      {/* Title and the chip row beneath it. */}
      <div className="mt-10">
        <Input
          variant="bare"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            latest.current = { ...latest.current, title: e.target.value };
            scheduleSave();
          }}
          placeholder="Untitled"
          aria-label="Entry title"
          className="w-full text-[20px] font-medium tracking-[-0.02em]"
        />
        <Input
          variant="bare"
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            latest.current = { ...latest.current, summary: e.target.value };
            scheduleSave();
          }}
          placeholder="One-line summary — this is what browse cards show"
          aria-label="Summary"
          className="mt-1 w-full text-sm text-ink-muted"
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Combobox
            options={destinations}
            value={entry.subcategoryId}
            onChange={(subcategoryId) =>
              startTransition(async () => {
                await updateEntryMeta({ id: entry.id, subcategoryId });
                router.refresh();
              })
            }
            className="w-64"
          />
          <Badge>{entry.template === "FEATURE" ? "Feature" : "Process"}</Badge>
          <span className="inline-flex items-center gap-1.5 text-meta text-ink-faint">
            <Avatar name={entry.owner.name} size="sm" />
            {entry.owner.name}
          </span>
          <TagRow entryId={entry.id} tags={entry.tags} />
        </div>
      </div>

      {/* The five sections, fixed order, one editor component. */}
      <div className="mt-12 flex flex-col gap-10">
        {entry.sections.map((section) => (
          <SectionEditor
            key={section.id}
            template={entry.template}
            kind={section.kind}
            body={bodies[section.id] ?? ""}
            onChange={(body) => {
              setBodies((prev) => ({ ...prev, [section.id]: body }));
              latest.current = {
                ...latest.current,
                bodies: { ...latest.current.bodies, [section.id]: body },
              };
              scheduleSave();
            }}
            extra={
              section.kind === "WHO" ? (
                <AssignmentPicker
                  entryId={entry.id}
                  assignments={entry.assignments}
                  users={users}
                />
              ) : section.kind === "WHEN" ? (
                <CadenceSelect
                  entryId={entry.id}
                  reviewIntervalDays={entry.reviewIntervalDays}
                />
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
}

function SectionEditor({
  template,
  kind,
  body,
  onChange,
  extra,
}: {
  template: Template;
  kind: Kind;
  body: string;
  onChange: (body: string) => void;
  extra: React.ReactNode;
}) {
  const filled = body.trim() !== "";
  const [expanded, setExpanded] = useState(filled);

  return (
    <section
      className={cn(
        // The 2px rail: accent when filled, muted when empty. Square
        // corners — no rounding on single-sided borders.
        "border-l-2 pl-5",
        filled ? "border-accent" : "border-hairline-strong",
      )}
    >
      <h2 className="section-label">{sectionLabel(template, kind)}</h2>
      {expanded || filled ? (
        <>
          <p className="mt-1 text-meta text-ink-faint">{sectionHint(template, kind)}</p>
          <Textarea
            variant="bare"
            autoGrow
            autoFocus={expanded && !filled}
            value={body}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${sectionLabel(template, kind)} body`}
            className="mt-2 -ml-2.5"
          />
        </>
      ) : (
        // Empty and collapsed: a one-line prompt keeps first load short
        // and unintimidating.
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-faint">{sectionHint(template, kind)}</p>
          <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}>
            Write this section
          </Button>
        </div>
      )}
      {extra ? <div className="mt-4">{extra}</div> : null}
    </section>
  );
}

function TagRow({
  entryId,
  tags,
}: {
  entryId: string;
  tags: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const label = draft.trim();
    setAdding(false);
    setDraft("");
    if (!label) return;
    startTransition(async () => {
      await addTag({ entryId, label });
      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 text-meta text-ink-muted"
        >
          {tag.label}
          <button
            type="button"
            aria-label={`Remove tag ${tag.label}`}
            className="rounded-control text-ink-faint transition-colors hover:text-danger"
            onClick={() =>
              startTransition(async () => {
                await removeTag({ entryId, tagId: tag.id });
                router.refresh();
              })
            }
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {adding ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="tag"
          className="h-6 w-28 text-meta"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
          className="inline-flex items-center gap-0.5 rounded-control text-meta text-ink-faint transition-colors hover:text-accent"
        >
          <Plus size={12} aria-hidden />
          Add tag
        </button>
      )}
    </span>
  );
}

function AssignmentPicker({
  entryId,
  assignments,
  users,
}: {
  entryId: string;
  assignments: { id: string; role: string; userId: string; userName: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"OWNER" | "APPROVER" | "CONTACT">("CONTACT");

  return (
    <div className="flex flex-col gap-2">
      {assignments.map((a) => (
        <span key={a.id} className="inline-flex items-center gap-2 text-sm text-ink-muted">
          <Avatar name={a.userName} size="sm" />
          {a.userName}
          <span className="text-meta text-ink-faint">
            {a.role.toLowerCase()}
          </span>
          <button
            type="button"
            aria-label={`Remove ${a.userName} as ${a.role.toLowerCase()}`}
            className="rounded-control text-ink-faint transition-colors hover:text-danger"
            onClick={() =>
              startTransition(async () => {
                await removeAssignment({ id: a.id });
                router.refresh();
              })
            }
          >
            <X size={13} />
          </button>
        </span>
      ))}
      <span className="flex flex-wrap items-center gap-2">
        <Select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          aria-label="Person to assign"
          className="w-44"
        >
          <option value="" disabled>
            Add someone
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          aria-label="Role"
          className="w-32"
        >
          <option value="CONTACT">Contact</option>
          <option value="APPROVER">Approver</option>
          <option value="OWNER">Owner</option>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          disabled={!userId}
          onClick={() =>
            startTransition(async () => {
              await setAssignment({ entryId, userId, role });
              setUserId("");
              router.refresh();
            })
          }
        >
          Add
        </Button>
      </span>
    </div>
  );
}

function CadenceSelect({
  entryId,
  reviewIntervalDays,
}: {
  entryId: string;
  reviewIntervalDays: number | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Select
      value={reviewIntervalDays ? String(reviewIntervalDays) : ""}
      aria-label="Review cadence"
      onChange={(e) =>
        startTransition(async () => {
          await setReviewInterval({
            entryId,
            days: e.target.value ? Number(e.target.value) : null,
          });
          router.refresh();
        })
      }
      className="w-56"
    >
      {CADENCES.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
