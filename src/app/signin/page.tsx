import { redirect } from "next/navigation";
import { Library } from "lucide-react";
import { auth, devSignInEnabled, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

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
        <div className="mt-6 flex flex-col gap-2">
          {devSignInEnabled ? (
            <form
              action={async () => {
                "use server";
                await signIn("dev", { redirectTo: "/" });
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
                await signIn("microsoft-entra-id", { redirectTo: "/" });
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
