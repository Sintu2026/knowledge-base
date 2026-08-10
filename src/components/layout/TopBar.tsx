import Link from "next/link";
import { Library } from "lucide-react";
import { signOut, type CurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NavLinks } from "@/components/layout/NavLinks";

type TopBarProps = {
  user: CurrentUser | null;
};

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 rounded-control">
          <Library size={18} className="text-accent" aria-hidden />
          <span className="font-medium">Knowledge base</span>
        </Link>
        <div className="flex items-center gap-2">
          <NavLinks />
          <ThemeToggle />
          {user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <button
                type="submit"
                title={`Sign out ${user.name}`}
                className="flex items-center rounded-control"
              >
                <Avatar name={user.name} />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
