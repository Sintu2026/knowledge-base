import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

// Placeholder: the read view ships in build step 9. Tiles and rows already
// link here so the URLs are final.
export default async function EntryPage(props: PageProps<"/entry/[id]">) {
  const [{ id }, user] = await Promise.all([props.params, getCurrentUser()]);

  const entry = await db.entry.findUnique({
    where: { id },
    include: { category: true, subcategory: true },
  });
  // Soft-deleted entries are gone from every reader's perspective; the row
  // survives only for admin-level recovery.
  if (!entry || entry.deletedAt) notFound();

  return (
    <PageShell user={user}>
      <Breadcrumbs
        items={[
          { label: "Browse", href: "/" },
          { label: entry.category.name, href: `/c/${entry.category.slug}` },
          {
            label: entry.subcategory.name,
            href: `/c/${entry.category.slug}/${entry.subcategory.slug}`,
          },
          { label: entry.title },
        ]}
      />
      <div className="flex flex-1 flex-col justify-center py-10">
        <EmptyState
          title={entry.title}
          description="The read view arrives in build step 9 — sections, blocks and skill recordings render here."
          action={
            <LinkButton
              href={`/c/${entry.category.slug}/${entry.subcategory.slug}`}
              variant="secondary"
            >
              Back to {entry.subcategory.name}
            </LinkButton>
          }
        />
      </div>
    </PageShell>
  );
}
