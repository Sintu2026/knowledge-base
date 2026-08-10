import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocab } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export const metadata = { title: "Add knowledge — Knowledge base" };

// Placeholder: the create flow ships in build step 6. This page exists so
// every "Add" affordance already links to its final URL.
export default async function NewEntryPage(props: PageProps<"/new">) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUser()]);
  const subcategoryId = typeof sp.subcategory === "string" ? sp.subcategory : null;

  const sub = subcategoryId
    ? await db.subcategory.findUnique({
        where: { id: subcategoryId },
        include: { category: true },
      })
    : null;

  return (
    <PageShell user={user}>
      <div className="flex flex-1 flex-col justify-center py-10">
        <EmptyState
          title="The editor arrives in build step 6"
          description={
            sub
              ? `It will open here pre-scoped to ${sub.category.name} › ${sub.name}, ready for a new ${vocab(sub.category.kind).entry}.`
              : "It will open here with a template and destination picker."
          }
          action={
            <LinkButton
              href={sub ? `/c/${sub.category.slug}/${sub.slug}` : "/"}
              variant="secondary"
            >
              Back to {sub ? sub.name : "browse"}
            </LinkButton>
          }
        />
      </div>
    </PageShell>
  );
}
