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
