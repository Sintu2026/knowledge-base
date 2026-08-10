import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex select-none items-center justify-center gap-1.5 rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

/*
 * Actions are text-first: the primary action is accent-coloured text with
 * no fill and no border — weight comes from colour and placement, not
 * from a slab of saturation. Only secondary (a genuinely bordered
 * interactive container) keeps chrome.
 */
const variants: Record<Variant, string> = {
  primary: "text-accent hover:bg-accent-tint hover:text-accent-hover",
  secondary:
    "border border-hairline bg-surface text-ink hover:border-hairline-strong hover:bg-sunken",
  ghost: "text-ink-muted hover:bg-sunken hover:text-ink",
  danger: "text-danger hover:bg-danger-tint",
};

const sizes: Record<Size, string> = {
  md: "h-8 px-3 text-sm",
  sm: "h-7 px-2.5 text-[13px]",
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
