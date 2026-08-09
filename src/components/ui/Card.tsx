import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const cardBase = "block rounded-card border border-hairline bg-surface";
const cardInteractive =
  "transition-colors hover:border-hairline-strong";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardBase, className)} {...props} />;
}

type LinkCardProps = ComponentProps<typeof Link>;

export function LinkCard({ className, ...props }: LinkCardProps) {
  return (
    <Link className={cn(cardBase, cardInteractive, className)} {...props} />
  );
}
