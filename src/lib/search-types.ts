// Shared between /api/search (producer) and SearchResults (consumer).

// Snippets mark matched terms with « » (see HL_START/HL_END in lib/search.ts);
// the client splits on them and renders warning-tinted spans — no HTML crosses
// the wire.
export type CategoryHit = {
  name: string;
  href: string;
  detail: string; // "6 modules · 4 features" / "Buildertrend › Schedules"
};

export type EntryHit = {
  id: string;
  title: string;
  template: "PROCESS" | "FEATURE";
  breadcrumb: string; // "Category › Subcategory"
  section: "WHAT" | "WHY" | "HOW" | "WHO" | "WHEN" | null; // which section matched
  snippet: string | null;
};

export type SkillHit = {
  id: string;
  entryId: string;
  title: string;
  durationSeconds: number | null;
  breadcrumb: string; // "Category › Subcategory › Entry"
  timestamp: number | null; // seconds into the video, when the hit was in the transcript
  snippet: string | null;
};

export type SearchResponse = {
  query: string;
  total: number;
  categoryCount: number; // distinct categories across all hits
  categories: CategoryHit[];
  entries: EntryHit[];
  skills: SkillHit[];
};
