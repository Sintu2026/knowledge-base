import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "neutral" | "accent" | "warning";

/*
 * Colour is never the only signal: neutral badges are outlined,
 * tinted badges (accent, warning) are filled with no border.
 */
const variants: Record<Variant, string> = {
  neutral: "border border-hairline text-ink-muted",
  accent: "border border-transparent bg-accent-tint text-accent",
  warning: "border border-transparent bg-warning-tint text-warning",
};

type BadgeProps = ComponentProps<"span"> & {
  variant?: Variant;
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-control px-1.5 text-xs",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
