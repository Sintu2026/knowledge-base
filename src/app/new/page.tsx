import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/PageShell";
import { NewEntryForm } from "@/components/editor/NewEntryForm";

export const metadata = { title: "Add knowledge — Knowledge base" };

export default async function NewEntryPage(props: PageProps<"/new">) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUser()]);
  const initialSubcategoryId =
    typeof sp.subcategory === "string" ? sp.subcategory : null;
  const initialTitle = typeof sp.title === "string" ? sp.title : "";

  const categories = await db.category.findMany({
    where: { archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      subcategories: { where: { archivedAt: null }, orderBy: { order: "asc" } },
    },
  });
  const destinations = categories.flatMap((category) =>
    category.subcategories.map((sub) => ({
      value: sub.id,
      label: sub.name,
      group: category.name,
    })),
  );
  const softwareSubcategoryIds = categories
    .filter((c) => c.kind === "SOFTWARE")
    .flatMap((c) => c.subcategories.map((s) => s.id));
  const pickerCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));

  return (
    <PageShell user={user}>
      <div>
        <h1 className="text-page-title text-ink">Add knowledge</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Pick a template and a home. The editor opens with the five
          sections ready; publishing needs only a title and a What.
        </p>
      </div>
      <NewEntryForm
        destinations={destinations}
        categories={pickerCategories}
        softwareSubcategoryIds={softwareSubcategoryIds}
        initialSubcategoryId={initialSubcategoryId}
        initialTitle={initialTitle}
      />
    </PageShell>
  );
}
