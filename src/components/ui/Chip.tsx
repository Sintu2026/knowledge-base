import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * Filter chip — a plain text link, no pill furniture. The active one is
 * full-weight ink; weight (not just colour) carries the state.
 */

const chipBase =
  "inline-flex h-7 select-none items-center gap-1 rounded-control px-1.5 text-sm transition-colors";
const chipInactive = "text-ink-muted hover:text-ink";
const chipActive = "font-medium text-ink";

export function chipClasses(active: boolean, className?: string) {
  return cn(chipBase, active ? chipActive : chipInactive, className);
}

type ChipProps = ComponentProps<"button"> & {
  active?: boolean;
};

export function Chip({ active = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={chipClasses(active, className)}
      {...props}
    />
  );
}

type ChipLinkProps = ComponentProps<typeof Link> & {
  active?: boolean;
};

export function ChipLink({ active = false, className, ...props }: ChipLinkProps) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={chipClasses(active, className)}
      {...props}
    />
  );
}
