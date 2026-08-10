import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EntryEditor, type EditorEntry } from "@/components/editor/EntryEditor";

export const metadata = { title: "Edit — Knowledge base" };

export default async function EntryEditPage(props: PageProps<"/entry/[id]/edit">) {
  const [{ id }] = await Promise.all([props.params, getCurrentUser()]);

  const entry = await db.entry.findUnique({
    where: { id },
    include: {
      owner: true,
      tags: { include: { tag: true } },
      assignments: { include: { user: true }, orderBy: { role: "asc" } },
      sections: { orderBy: { order: "asc" } },
    },
  });
  if (!entry) notFound();

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

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const editorEntry: EditorEntry = {
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    template: entry.template,
    status: entry.status,
    subcategoryId: entry.subcategoryId,
    reviewIntervalDays: entry.reviewIntervalDays,
    owner: { name: entry.owner.name },
    tags: entry.tags.map((t) => ({ id: t.tag.id, label: t.tag.label })),
    assignments: entry.assignments.map((a) => ({
      id: a.id,
      role: a.role,
      userId: a.userId,
      userName: a.user.name,
    })),
    sections: entry.sections.map((s) => ({ id: s.id, kind: s.kind, body: s.body })),
  };

  return (
    <div className="flex min-h-full flex-col">
      <EntryEditor entry={editorEntry} destinations={destinations} users={users} />
    </div>
  );
}
