/*
 * Notifications seam (§11: build none of it, leave the seam). Wiring a
 * real channel — email, Slack, whatever the company adopts — means
 * implementing these functions; callers already pass everything a
 * message needs. Review-due reminders will additionally need a schedule
 * (a cron hitting a route that queries isReviewOverdue owners); nothing
 * calls that today by design.
 */

export async function notifySuggestionAdded(input: {
  entryId: string;
  entryTitle: string;
  ownerEmail: string;
  authorName: string;
}): Promise<void> {
  void input; // no channel configured yet
}

export async function notifyEntryPublished(input: {
  entryId: string;
  entryTitle: string;
  authorName: string;
}): Promise<void> {
  void input; // no channel configured yet
}
