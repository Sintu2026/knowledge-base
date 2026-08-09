import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * The scanning primitive: bordered rows, not cards, for any list longer
 * than four items. Wrap rows in <RowList> to get the outer border and
 * per-row hairlines.
 */

export function RowList({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "divide-y divide-hairline rounded-card border border-hairline bg-surface",
        className,
      )}
      {...props}
    />
  );
}

type RowContentProps = {
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

function RowContent({ leading, trailing, children }: RowContentProps) {
  return (
    <>
      {leading ? (
        <span className="flex shrink-0 items-center text-ink-muted">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing ? (
        <span className="flex shrink-0 items-center gap-2 text-ink-muted">
          {trailing}
        </span>
      ) : null}
    </>
  );
}

const rowBase = "flex items-center gap-3 px-3 py-2.5 text-sm";

type RowProps = ComponentProps<"div"> & RowContentProps;

export function Row({
  leading,
  trailing,
  children,
  className,
  ...props
}: RowProps) {
  return (
    <div className={cn(rowBase, className)} {...props}>
      <RowContent leading={leading} trailing={trailing}>
        {children}
      </RowContent>
    </div>
  );
}

type RowLinkProps = ComponentProps<typeof Link> & RowContentProps;

export function RowLink({
  leading,
  trailing,
  children,
  className,
  ...props
}: RowLinkProps) {
  return (
    <Link
      className={cn(rowBase, "transition-colors hover:bg-sunken", className)}
      {...props}
    >
      <RowContent leading={leading} trailing={trailing}>
        {children}
      </RowContent>
    </Link>
  );
}
