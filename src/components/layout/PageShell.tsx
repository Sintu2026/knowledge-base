import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";

type PageShellProps = {
  user: CurrentUser | null;
  children: ReactNode;
};

export function PageShell({ user, children }: PageShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
