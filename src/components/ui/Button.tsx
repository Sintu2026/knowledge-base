import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex select-none items-center justify-center gap-1.5 rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

/*
 * Actions look like actions (post-step-9 review): primary and danger are
 * filled, secondary is a real bordered control, and all of them carry
 * enough height and padding to read as clickable. The page around them
 * stays calm — buttons are where the colour is allowed to land.
 */
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary:
    "border border-hairline-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink-muted hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-danger-contrast hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "h-9 px-4 text-sm",
  sm: "h-8 px-3 text-[14px]",
};

export function buttonClasses(
  variant: Variant = "secondary",
  size: Size = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props} />
  );
}
