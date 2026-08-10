import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { Library } from "lucide-react";
import { auth, devSignInEnabled, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

// signIn throws NEXT_REDIRECT on success — only AuthError means failure.
async function attempt(provider: string) {
  try {
    await signIn(provider, { redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/signin?error=1");
    throw error;
  }
}

export default async function SignInPage(props: PageProps<"/signin">) {
  const [session, sp] = await Promise.all([auth(), props.searchParams]);
  if (session?.user) redirect("/");
  const failed = sp.error !== undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8">
        <div className="flex items-center gap-2">
          <Library size={18} className="text-accent" aria-hidden />
          <span className="font-medium">Knowledge base</span>
        </div>
        <p className="mt-2 text-ink-muted">
          What the team keeps re-explaining, written down once.
        </p>
        {failed ? (
          <div className="mt-4 rounded-control bg-danger-tint p-3 text-sm text-danger">
            Sign-in didn&apos;t complete. The dev server log names the cause —
            most often the app can&apos;t reach the database. Run{" "}
            <code className="font-mono">npm run db:check</code> to test the
            exact connection the app uses.
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          {devSignInEnabled ? (
            <form
              action={async () => {
                "use server";
                await attempt("dev");
              }}
            >
              <Button type="submit" className="w-full">
                Continue as dev user
              </Button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await attempt("microsoft-entra-id");
              }}
            >
              <Button type="submit" className="w-full">
                Sign in with Microsoft
              </Button>
            </form>
          )}
          <p className="text-center text-xs text-ink-muted">
            {devSignInEnabled
              ? "Microsoft sign-in activates once the Entra app registration is configured."
              : "Use your Caizen Homes account."}
          </p>
        </div>
      </div>
    </main>
  );
}
