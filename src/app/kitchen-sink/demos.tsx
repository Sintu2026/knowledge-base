"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Combobox } from "@/components/ui/Combobox";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

const destinations = [
  { value: "onboarding", label: "Onboarding", group: "People ops", hint: "area" },
  { value: "offboarding", label: "Offboarding", group: "People ops", hint: "area" },
  { value: "invoices", label: "Invoices", group: "Xero", hint: "module" },
  { value: "bank-feeds", label: "Bank feeds", group: "Xero", hint: "module" },
  { value: "payroll", label: "Payroll", group: "Xero", hint: "module" },
];

export function ComboboxDemo() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="max-w-xs">
      <Combobox
        options={destinations}
        value={value}
        onChange={setValue}
        placeholder="Choose a destination"
      />
    </div>
  );
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this entry"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Delete entry
            </Button>
          </>
        }
      >
        <p className="text-ink-muted">
          This removes the entry and its 3 skill recordings. Revisions keep a
          copy that an admin can restore.
        </p>
      </Modal>
    </>
  );
}

export function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast({ title: "Link copied", description: "Paste it anywhere." })
        }
      >
        Show toast
      </Button>
      <Button
        onClick={() =>
          toast({
            title: "Upload failed",
            description: "The file is over 500 MB. Trim the recording and retry.",
            variant: "danger",
          })
        }
      >
        Show error toast
      </Button>
    </div>
  );
}

export function TabsDemo() {
  const [active, setActive] = useState("all");
  return (
    <Tabs
      aria-label="Example tabs"
      tabs={[
        { id: "all", label: "All entries" },
        { id: "mine", label: "Your entries" },
        { id: "review", label: "Needs review" },
      ]}
      active={active}
      onChange={setActive}
    />
  );
}

export function ChipDemo() {
  const [active, setActive] = useState("all");
  const chips = ["All", "Xero", "Procurement", "Has recording", "Needs review"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((label) => {
        const id = label.toLowerCase();
        return (
          <Chip key={id} active={active === id} onClick={() => setActive(id)}>
            {label}
          </Chip>
        );
      })}
    </div>
  );
}
