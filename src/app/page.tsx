import { Library } from "lucide-react";
import { getCurrentUser, signOut } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <Library size={18} className="text-accent" aria-hidden />
            <span className="font-medium">Knowledge base</span>
          </div>
          <div className="flex items-center gap-2">
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-10">
        <EmptyState
          title="The knowledge base is being built"
          description="Browse and search arrive in the next build steps. The component library is ready to review."
          action={
            <LinkButton href="/kitchen-sink" variant="primary">
              Open the kitchen sink
            </LinkButton>
          }
        />
      </main>
    </div>
  );
}
