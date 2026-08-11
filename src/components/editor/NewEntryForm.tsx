"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { createEntry } from "@/lib/actions/entries";

type NewEntryFormProps = {
  destinations: ComboboxOption[]; // subcategories, grouped by category
  softwareSubcategoryIds: string[]; // to default the template by destination
  initialSubcategoryId: string | null;
  initialTitle: string;
};

export function NewEntryForm({
  destinations,
  softwareSubcategoryIds,
  initialSubcategoryId,
  initialTitle,
}: NewEntryFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);
  const [template, setTemplate] = useState<"PROCESS" | "FEATURE">(
    initialSubcategoryId && softwareSubcategoryIds.includes(initialSubcategoryId)
      ? "FEATURE"
      : "PROCESS",
  );
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (!subcategoryId) {
      setError("Pick where this lives first.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createEntry({ template, subcategoryId, title });
        if (result.ok && result.id) {
          router.push(`/entry/${result.id}/edit`);
        } else if (!result.ok) {
          setError(result.error);
        }
      } catch {
        setError(
          "Couldn't reach the server. Check that it's running (and the database with it — `npm run db:check`), then try again.",
        );
      }
    });
  };

  return (
    <div className="mt-10 flex max-w-xl flex-col gap-7">
      <div>
        <span className="section-label">Template</span>
        <div className="mt-2 flex gap-1.5">
          <Chip active={template === "PROCESS"} onClick={() => setTemplate("PROCESS")}>
            Process — a way of working
          </Chip>
          <Chip active={template === "FEATURE"} onClick={() => setTemplate("FEATURE")}>
            Feature — how to do one thing in software
          </Chip>
        </div>
      </div>
      <div>
        <span className="section-label">Where it lives</span>
        <Combobox
          className="mt-2"
          options={destinations}
          value={subcategoryId}
          onChange={(id) => {
            setSubcategoryId(id);
            setTemplate(softwareSubcategoryIds.includes(id) ? "FEATURE" : "PROCESS");
            setError(null);
          }}
          placeholder="Search categories and modules"
        />
      </div>
      <div>
        <span className="section-label">Title</span>
        <Input
          className="mt-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What the team keeps re-explaining"
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button variant="primary" onClick={create} disabled={pending}>
          {pending ? "Creating…" : "Create and open the editor"}
        </Button>
      </div>
    </div>
  );
}
