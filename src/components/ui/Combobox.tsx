"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Options with the same group render under a shared muted heading. */
  group?: string;
  hint?: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText = "No matches",
  className,
}: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // null = not editing; the input shows the selected option's label.
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query?.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.group?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const clampedActive = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  function openList() {
    setOpen(true);
    setActiveIndex(
      Math.max(
        filtered.findIndex((o) => o.value === value),
        0,
      ),
    );
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function select(option: ComboboxOption) {
    onChange(option.value);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      setActiveIndex(Math.min(clampedActive + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActiveIndex(Math.max(clampedActive - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[clampedActive]) {
        e.preventDefault();
        select(filtered[clampedActive]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && filtered[clampedActive]
            ? `${listId}-${filtered[clampedActive].value}`
            : undefined
        }
        value={query ?? selected?.label ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onFocus={openList}
        onBlur={close}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-control border border-hairline bg-surface pl-2.5 pr-8 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-hairline-strong"
      />
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          // Prevent blur on the input so clicks land before the list unmounts.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-control border border-hairline bg-surface py-1"
        >
          {filtered.length === 0 && (
            <li className="px-2.5 py-1.5 text-sm text-ink-muted">{emptyText}</li>
          )}
          {filtered.map((option, i) => {
            const groupStart =
              option.group && option.group !== filtered[i - 1]?.group;
            return (
              <li key={option.value}>
                {groupStart && (
                  <div className="section-label px-2.5 pb-1 pt-2">
                    {option.group}
                  </div>
                )}
                <button
                  type="button"
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => select(option)}
                  onMouseMove={() => setActiveIndex(i)}
                  className={cn(
                    "flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-sm",
                    i === clampedActive ? "bg-sunken text-ink" : "text-ink",
                    option.value === value && "font-medium",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="shrink-0 text-xs text-ink-muted">
                      {option.hint}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
