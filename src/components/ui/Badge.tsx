import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "neutral" | "accent" | "warning";

/*
 * Status as quiet text — no fill, no border. A badge annotates; it never
 * competes with content.
 */
const variants: Record<Variant, string> = {
  neutral: "text-ink-faint",
  accent: "text-accent",
  warning: "text-warning",
};

type BadgeProps = ComponentProps<"span"> & {
  variant?: Variant;
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-meta",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
