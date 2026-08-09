import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * Filter chip. Active state is both tinted and medium-weight, so colour
 * is never the only signal.
 */

const chipBase =
  "inline-flex h-7 select-none items-center gap-1 rounded-control border px-2.5 text-[13px] transition-colors";
const chipInactive =
  "border-hairline text-ink-muted hover:border-hairline-strong hover:text-ink";
const chipActive = "border-transparent bg-accent-tint font-medium text-accent";

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
