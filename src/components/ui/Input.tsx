import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentProps<"input"> & {
  /** "bare" removes the border and background — used for the entry title. */
  variant?: "default" | "bare";
};

export function Input({ variant = "default", className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full text-ink placeholder:text-ink-faint",
        variant === "default" &&
          "h-8 rounded-control border border-hairline bg-surface px-2.5 text-sm transition-colors focus:border-hairline-strong",
        variant === "bare" && "bg-transparent",
        className,
      )}
      {...props}
    />
  );
}
