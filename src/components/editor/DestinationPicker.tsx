"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { createDestination } from "@/lib/actions/taxonomy";

/*
 * The destination picker, creatable (post-step-9 review): typing a name
 * that matches nothing offers "Create …" inline, for both levels — a new
 * module/area under an existing category, or a whole new category (which
 * asks for its kind, and for a first module, because entries live at the
 * subcategory level). Taxonomy admin is for tidying up later; it is never
 * a prerequisite for contributing.
 */

export type PickerCategory = {
  id: string;
  name: string;
  kind: "PROCESS" | "SOFTWARE";
};

export function DestinationPicker({
  destinations,
  categories,
  value,
  onSelect,
  placeholder,
  className,
}: {
  destinations: ComboboxOption[];
  categories: PickerCategory[];
  value: string | null;
  onSelect: (
    subcategoryId: string,
    categoryKind: "PROCESS" | "SOFTWARE",
    // The option to show for a just-created destination the server list
    // doesn't know yet.
    created?: ComboboxOption,
  ) => void;
  placeholder?: string;
  className?: string;
}) {
  const [creating, setCreating] = useState<string | null>(null); // prefilled name

  const kindOf = (subcategoryId: string): "PROCESS" | "SOFTWARE" => {
    const option = destinations.find((o) => o.value === subcategoryId);
    const category = categories.find((c) => c.name === option?.group);
    return category?.kind ?? "PROCESS";
  };

  return (
    <>
      <Combobox
        options={destinations}
        value={value}
        onChange={(subcategoryId) => onSelect(subcategoryId, kindOf(subcategoryId))}
        placeholder={placeholder}
        className={className}
        onCreate={(query) => setCreating(query)}
        createLabel={(query) => `Create “${query}”…`}
      />
      {creating !== null ? (
        <CreateDestinationModal
          initialName={creating}
          categories={categories}
          onClose={() => setCreating(null)}
          onCreated={(subcategoryId, categoryKind, option) => {
            setCreating(null);
            onSelect(subcategoryId, categoryKind, option);
          }}
        />
      ) : null}
    </>
  );
}

function CreateDestinationModal({
  initialName,
  categories,
  onClose,
  onCreated,
}: {
  initialName: string;
  categories: PickerCategory[];
  onClose: () => void;
  onCreated: (
    subcategoryId: string,
    categoryKind: "PROCESS" | "SOFTWARE",
    option: ComboboxOption,
  ) => void;
}) {
  const [level, setLevel] = useState<"subcategory" | "category">(
    categories.length > 0 ? "subcategory" : "category",
  );
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [kind, setKind] = useState<"SOFTWARE" | "PROCESS">("SOFTWARE");
  const [subName, setSubName] = useState("General");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parent = categories.find((c) => c.id === categoryId);
  const subWord = (k: "PROCESS" | "SOFTWARE" | undefined) =>
    k === "SOFTWARE" ? "module" : "area";

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createDestination(
        level === "subcategory"
          ? { level, categoryId, name }
          : { level, kind, name, subName },
      );
      setBusy(false);
      if (result.ok) {
        onCreated(result.subcategoryId, result.categoryKind, {
          value: result.subcategoryId,
          label: level === "subcategory" ? name.trim() : subName.trim(),
          group: level === "subcategory" ? (parent?.name ?? "") : name.trim(),
        });
      } else {
        setError(result.error);
      }
    } catch {
      setBusy(false);
      setError("Couldn't reach the server — try again.");
    }
  };

  return (
    <Modal open onClose={onClose} title={`Create “${name.trim() || initialName}”`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {categories.length > 0 ? (
            <Chip
              active={level === "subcategory"}
              onClick={() => setLevel("subcategory")}
            >
              A {subWord(parent?.kind)} in an existing category
            </Chip>
          ) : null}
          <Chip active={level === "category"} onClick={() => setLevel("category")}>
            A new category
          </Chip>
        </div>

        <label className="block">
          <span className="mb-1 block text-[15px] text-ink-muted">Name</span>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {level === "subcategory" ? (
          <label className="block">
            <span className="mb-1 block text-[15px] text-ink-muted">
              Inside which category?
            </span>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} —{" "}
                  {category.kind === "SOFTWARE" ? "software" : "department"}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <>
            <div>
              <span className="mb-1 block text-[15px] text-ink-muted">
                What kind of category?
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={kind === "SOFTWARE"} onClick={() => setKind("SOFTWARE")}>
                  Software — a product with modules
                </Chip>
                <Chip active={kind === "PROCESS"} onClick={() => setKind("PROCESS")}>
                  Department — an area of work
                </Chip>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-[15px] text-ink-muted">
                Its first {subWord(kind)} — where this entry will live
              </span>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} />
            </label>
          </>
        )}

        {error ? <p className="text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={create}>
            {busy ? "Creating…" : "Create and select"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
