"use client";

import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { plural } from "@/lib/format";
import {
  archiveCategory,
  archiveSubcategory,
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  renameCategory,
  renameSubcategory,
  reorderCategories,
  reorderSubcategories,
  restoreCategory,
  restoreSubcategory,
  type ActionResult,
} from "@/lib/actions/taxonomy";

type AdminSubcategory = {
  id: string;
  name: string;
  archived: boolean;
  entryCount: number;
};

type AdminCategory = {
  id: string;
  name: string;
  kind: "PROCESS" | "SOFTWARE";
  archived: boolean;
  entryCount: number;
  subcategories: AdminSubcategory[];
};

type Destination = { id: string; label: string };

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast({ title: result.error, variant: "danger" });
      router.refresh();
    });
  return { run, pending };
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="ghost" size="sm" aria-label={label} title={label} onClick={onClick} className="px-1.5">
      {children}
    </Button>
  );
}

function InlineName({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (name: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    // Server data changed underneath — adopt it (render-time state sync).
    setPrevValue(value);
    setDraft(value);
  }

  const save = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== value) onSave(name);
    else setDraft(value);
  };

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <span className={className}>{value}</span>
        <IconButton label={`Rename ${value}`} onClick={() => setEditing(true)}>
          <Pencil size={14} />
        </IconButton>
      </span>
    );
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="h-7 w-56 text-sm"
    />
  );
}

// Shared drag-and-drop ordering for one level of the list. Keyboard path:
// the move up/down buttons on each row.
function useDragOrder(ids: string[], commit: (ids: string[]) => void) {
  const [order, setOrder] = useState(ids);
  const key = ids.join("\n");
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    // Server data changed underneath — adopt it (render-time state sync).
    setPrevKey(key);
    setOrder(ids);
  }
  // Only ever touched inside drag event handlers.
  const from = useRef<number | null>(null);

  const arrange = (list: string[], fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= list.length) return list;
    const next = [...list];
    const [id] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, id);
    return next;
  };

  return {
    order,
    onDragStart: (index: number) => {
      from.current = index;
    },
    onDragOver: (index: number) => {
      const f = from.current;
      if (f !== null && f !== index) {
        setOrder((prev) => arrange(prev, f, index));
        from.current = index;
      }
    },
    onDragEnd: () => {
      from.current = null;
      // Handlers are re-bound every render, so `order` here is current.
      if (order.join("\n") !== key) commit(order);
    },
    nudge: (index: number, delta: number) => {
      const next = arrange(order, index, index + delta);
      if (next.join("\n") !== key) {
        setOrder(next);
        commit(next);
      }
    },
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[13px] text-ink-muted">{children}</span>;
}

export function TaxonomyAdmin({
  categories,
  destinations,
}: {
  categories: AdminCategory[];
  destinations: Destination[];
}) {
  const { run } = useRun();
  const [adding, setAdding] = useState(false);
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  const drag = useDragOrder(
    active.map((c) => c.id),
    (ids) => run(() => reorderCategories({ ids })),
  );
  const byId = new Map(active.map((c) => [c.id, c]));

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title font-medium">Taxonomy</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Two levels, no more: categories, and the modules or areas inside
            them. Drag to reorder; archiving hides a level from browse without
            losing it.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          Add category
        </Button>
      </div>

      <div className="mt-6 divide-y divide-hairline border-y border-hairline">
        {drag.order.map((id, index) => {
          const category = byId.get(id);
          if (!category) return null;
          return (
            <CategoryBlock
              key={id}
              category={category}
              destinations={destinations}
              index={index}
              count={drag.order.length}
              onDragStart={drag.onDragStart}
              onDragOver={drag.onDragOver}
              onDragEnd={drag.onDragEnd}
              onNudge={drag.nudge}
            />
          );
        })}
        {active.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            No categories yet. Add the first one — a product you train people
            on, or an area of work.
          </p>
        ) : null}
      </div>

      {archived.length > 0 ? (
        <section className="mt-8">
          <h2 className="section-label">Archived</h2>
          <div className="mt-2 divide-y divide-hairline border-y border-hairline">
            {archived.map((category) => (
              <ArchivedRow
                key={category.id}
                name={category.name}
                detail={category.kind === "SOFTWARE" ? "Software" : "Process"}
                onRestore={() => run(() => restoreCategory({ id: category.id }))}
                onDelete={() => run(() => deleteCategory({ id: category.id }))}
              />
            ))}
          </div>
        </section>
      ) : null}

      <AddCategoryModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function CategoryBlock({
  category,
  destinations,
  index,
  count,
  onDragStart,
  onDragOver,
  onDragEnd,
  onNudge,
}: {
  category: AdminCategory;
  destinations: Destination[];
  index: number;
  count: number;
  onDragStart: (i: number) => void;
  onDragOver: (i: number) => void;
  onDragEnd: () => void;
  onNudge: (i: number, delta: number) => void;
}) {
  const { run } = useRun();
  const [addingSub, setAddingSub] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const subWord = category.kind === "SOFTWARE" ? "module" : "area";

  return (
    <div
      className="py-2"
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5">
        <span
          draggable
          onDragStart={() => onDragStart(index)}
          onDragEnd={onDragEnd}
          className="cursor-grab text-ink-faint"
          aria-hidden
        >
          <GripVertical size={16} />
        </span>
        <InlineName
          value={category.name}
          onSave={(name) => run(() => renameCategory({ id: category.id, name }))}
          className="truncate text-sm font-medium"
        />
        <Badge>{category.kind === "SOFTWARE" ? "Software" : "Process"}</Badge>
        <span className="text-[13px] text-ink-muted">
          {plural(category.entryCount, "entry", "entries")}
        </span>
        <span className="ml-auto flex items-center">
          <IconButton label={`Move ${category.name} up`} onClick={() => onNudge(index, -1)}>
            <ChevronUp size={14} className={index === 0 ? "opacity-30" : undefined} />
          </IconButton>
          <IconButton label={`Move ${category.name} down`} onClick={() => onNudge(index, 1)}>
            <ChevronDown size={14} className={index === count - 1 ? "opacity-30" : undefined} />
          </IconButton>
          <IconButton label={`Add ${subWord === "module" ? "a module" : "an area"} to ${category.name}`} onClick={() => setAddingSub(true)}>
            <Plus size={14} />
          </IconButton>
          <IconButton
            label={`Archive ${category.name}`}
            onClick={() => run(() => archiveCategory({ id: category.id }))}
          >
            <Archive size={14} />
          </IconButton>
          <IconButton label={`Delete ${category.name}`} onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={14} />
          </IconButton>
        </span>
      </div>

      <SubcategoryList category={category} destinations={destinations} />

      <AddSubcategoryModal
        open={addingSub}
        onClose={() => setAddingSub(false)}
        categoryId={category.id}
        categoryName={category.name}
        subWord={subWord}
      />
      <ConfirmDeleteModal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        name={category.name}
        onConfirm={() => run(() => deleteCategory({ id: category.id }))}
      />
    </div>
  );
}

function SubcategoryList({
  category,
  destinations,
}: {
  category: AdminCategory;
  destinations: Destination[];
}) {
  const { run } = useRun();
  const activeSubs = category.subcategories.filter((s) => !s.archived);
  const archivedSubs = category.subcategories.filter((s) => s.archived);
  const drag = useDragOrder(
    activeSubs.map((s) => s.id),
    (ids) => run(() => reorderSubcategories({ ids })),
  );
  const byId = new Map(activeSubs.map((s) => [s.id, s]));
  const subWord = category.kind === "SOFTWARE" ? "module" : "area";

  if (category.subcategories.length === 0) {
    return (
      <p className="py-1.5 pl-7 text-[13px] text-ink-muted">
        No {subWord}s yet — add the first one.
      </p>
    );
  }

  return (
    <div className="pl-7">
      {drag.order.map((id, index) => {
        const sub = byId.get(id);
        if (!sub) return null;
        return (
          <SubcategoryRow
            key={id}
            sub={sub}
            subWord={subWord}
            destinations={destinations}
            index={index}
            count={drag.order.length}
            onDragStart={drag.onDragStart}
            onDragOver={drag.onDragOver}
            onDragEnd={drag.onDragEnd}
            onNudge={drag.nudge}
          />
        );
      })}
      {archivedSubs.map((sub) => (
        <ArchivedRow
          key={sub.id}
          name={sub.name}
          detail={plural(sub.entryCount, "entry", "entries")}
          onRestore={() => run(() => restoreSubcategory({ id: sub.id }))}
          onDelete={() => run(() => deleteSubcategory({ id: sub.id }))}
        />
      ))}
    </div>
  );
}

function SubcategoryRow({
  sub,
  subWord,
  destinations,
  index,
  count,
  onDragStart,
  onDragOver,
  onDragEnd,
  onNudge,
}: {
  sub: AdminSubcategory;
  subWord: string;
  destinations: Destination[];
  index: number;
  count: number;
  onDragStart: (i: number) => void;
  onDragOver: (i: number) => void;
  onDragEnd: () => void;
  onNudge: (i: number, delta: number) => void;
}) {
  const { run } = useRun();
  const [archiving, setArchiving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className="flex items-center gap-1.5 py-1"
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={(e) => e.preventDefault()}
    >
      <span
        draggable
        onDragStart={() => onDragStart(index)}
        onDragEnd={onDragEnd}
        className="cursor-grab text-ink-faint"
        aria-hidden
      >
        <GripVertical size={14} />
      </span>
      <InlineName
        value={sub.name}
        onSave={(name) => run(() => renameSubcategory({ id: sub.id, name }))}
        className="truncate text-sm"
      />
      <span className="text-[13px] text-ink-muted">
        {plural(sub.entryCount, "entry", "entries")}
      </span>
      <span className="ml-auto flex items-center">
        <IconButton label={`Move ${sub.name} up`} onClick={() => onNudge(index, -1)}>
          <ChevronUp size={14} className={index === 0 ? "opacity-30" : undefined} />
        </IconButton>
        <IconButton label={`Move ${sub.name} down`} onClick={() => onNudge(index, 1)}>
          <ChevronDown size={14} className={index === count - 1 ? "opacity-30" : undefined} />
        </IconButton>
        <IconButton
          label={`Archive ${sub.name}`}
          onClick={() => {
            if (sub.entryCount > 0) setArchiving(true);
            else run(() => archiveSubcategory({ id: sub.id }));
          }}
        >
          <Archive size={14} />
        </IconButton>
        <IconButton label={`Delete ${sub.name}`} onClick={() => setConfirmingDelete(true)}>
          <Trash2 size={14} />
        </IconButton>
      </span>

      <ArchiveSubcategoryModal
        open={archiving}
        onClose={() => setArchiving(false)}
        sub={sub}
        subWord={subWord}
        destinations={destinations.filter((d) => d.id !== sub.id)}
      />
      <ConfirmDeleteModal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        name={sub.name}
        onConfirm={() => run(() => deleteSubcategory({ id: sub.id }))}
      />
    </div>
  );
}

function ArchivedRow({
  name,
  detail,
  onRestore,
  onDelete,
}: {
  name: string;
  detail: string;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-1.5 text-ink-muted">
      <span className="w-[16px]" aria-hidden />
      <span className="truncate text-sm">{name}</span>
      <Badge>Archived</Badge>
      <span className="text-[13px]">{detail}</span>
      <span className="ml-auto flex items-center">
        <IconButton label={`Restore ${name}`} onClick={onRestore}>
          <RotateCcw size={14} />
        </IconButton>
        <IconButton label={`Delete ${name}`} onClick={onDelete}>
          <Trash2 size={14} />
        </IconButton>
      </span>
    </div>
  );
}

function AddCategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run } = useRun();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"SOFTWARE" | "PROCESS">("SOFTWARE");
  const [description, setDescription] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(() => createCategory({ name, kind, description }));
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add category">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label>
          <FieldLabel>Name</FieldLabel>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Buildertrend, Finance…"
          />
        </label>
        <label>
          <FieldLabel>Kind</FieldLabel>
          <Select value={kind} onChange={(e) => setKind(e.target.value as "SOFTWARE" | "PROCESS")} className="w-full">
            <option value="SOFTWARE">Software — modules of features</option>
            <option value="PROCESS">Process — areas of ways of working</option>
          </Select>
        </label>
        <label>
          <FieldLabel>Description</FieldLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="One line on what belongs here"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Add category
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddSubcategoryModal({
  open,
  onClose,
  categoryId,
  categoryName,
  subWord,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  subWord: string;
}) {
  const { run } = useRun();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(() => createSubcategory({ categoryId, name, description }));
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Add ${subWord === "module" ? "a module" : "an area"} to ${categoryName}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label>
          <FieldLabel>Name</FieldLabel>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <FieldLabel>Description</FieldLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="One line on what belongs here"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Add {subWord}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ArchiveSubcategoryModal({
  open,
  onClose,
  sub,
  subWord,
  destinations,
}: {
  open: boolean;
  onClose: () => void;
  sub: AdminSubcategory;
  subWord: string;
  destinations: Destination[];
}) {
  const { run } = useRun();
  const [target, setTarget] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={`Archive ${sub.name}`}>
      <p className="text-ink-muted">
        {sub.name} has {plural(sub.entryCount, "entry", "entries")}. Choose the{" "}
        {subWord} they move to — nothing is lost when a level is archived.
      </p>
      <label className="mt-3 block">
        <FieldLabel>Move entries to</FieldLabel>
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">
          <option value="" disabled>
            Choose a destination
          </option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </Select>
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!target}
          onClick={() => {
            run(() => archiveSubcategory({ id: sub.id, moveToSubcategoryId: target }));
            onClose();
          }}
        >
          Move entries and archive
        </Button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({
  open,
  onClose,
  name,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${name}`}>
      <p className="text-ink-muted">
        Deleting removes {name} permanently. Anything with entries is blocked —
        archive instead if it might come back.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Delete {name}
        </Button>
      </div>
    </Modal>
  );
}
