"use client";

import { Button } from "@/components/ui/Button";

/*
 * The route-level error boundary: when a page crashes server-side, say so
 * in plain language instead of rendering nothing. The digest ties the
 * message to the server terminal's stack trace.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-section-head text-ink">Something broke on this page</h1>
      <p className="mt-3 max-w-md text-sm text-ink-muted">
        The server hit an error rendering this view. The details are in the
        server terminal
        {error.digest ? (
          <>
            {" "}
            (digest <code className="rounded-control bg-sunken px-1">{error.digest}</code>)
          </>
        ) : null}
        . If the database just went away, <code className="rounded-control bg-sunken px-1">npm run db:check</code>{" "}
        will say so.
      </p>
      <Button variant="primary" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
