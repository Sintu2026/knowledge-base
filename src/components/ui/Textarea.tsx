import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type TextareaProps = ComponentProps<"textarea"> & {
  /** "bare" removes the border until focus — used inside section editors. */
  variant?: "default" | "bare";
  /** Grow with content (CSS field-sizing; falls back to fixed rows). */
  autoGrow?: boolean;
};

export function Textarea({
  variant = "default",
  autoGrow = false,
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full text-ink placeholder:text-ink-faint",
        variant === "default" &&
          "rounded-control border border-hairline bg-surface px-2.5 py-2 text-sm transition-colors focus:border-hairline-strong",
        variant === "bare" &&
          "rounded-control border border-transparent bg-transparent px-2.5 py-2 text-sm transition-colors focus:border-hairline",
        autoGrow && "min-h-16 resize-none [field-sizing:content]",
        className,
      )}
      {...props}
    />
  );
}
