import type { CurrentUser } from "@/lib/auth";

/*
 * The entire permission model. Access is open: every signed-in employee can
 * read, create, and edit anything. Safety comes from revisions (reversible)
 * and authorship (attributable), not from locks.
 *
 * If a restricted category ever becomes necessary, this is the one file
 * that changes.
 */

export function canRead(user: CurrentUser | null): boolean {
  return user !== null;
}

export function canEdit(user: CurrentUser | null): boolean {
  return user !== null;
}

export function canDelete(user: CurrentUser | null): boolean {
  return user !== null;
}

/*
 * The one narrow exception to open access: soft-deleting an entry removes it
 * from everyone's search and browse, so it belongs to the entry's owner and
 * to admins. Admins are named in ADMIN_EMAILS (comma-separated, in .env) —
 * there is no role system, and this file stays the whole permission model.
 */
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdmin(user: CurrentUser | null): boolean {
  return user !== null && adminEmails.has(user.email.toLowerCase());
}

export function canDeleteEntry(
  user: CurrentUser | null,
  entry: { ownerId: string },
): boolean {
  return user !== null && (user.id === entry.ownerId || isAdmin(user));
}
