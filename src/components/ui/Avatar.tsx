import { cn } from "@/lib/cn";

type AvatarProps = {
  name: string;
  size?: "sm" | "md";
  className?: string;
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const sizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-[11px]",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-control border border-hairline bg-sunken font-medium text-ink-muted",
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
