import { db } from "./db";

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

// Called on sign-in (and as a fallback from getCurrentUser). Entra is the
// source of truth for the display name, so it is refreshed on every sign-in.
export async function upsertUserByEmail(email: string, name?: string | null) {
  const displayName = name?.trim() || email.split("@")[0];
  return db.user.upsert({
    where: { email },
    update: { name: displayName, avatarInitials: initialsFor(displayName) },
    create: { email, name: displayName, avatarInitials: initialsFor(displayName) },
  });
}
