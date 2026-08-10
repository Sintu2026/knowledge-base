import { Prisma } from "../generated/prisma/client";
import { db } from "./db";
import type {
  CategoryHit,
  EntryHit,
  SearchResponse,
  SkillHit,
} from "./search-types";

/*
 * Full-text search over SearchDoc (maintained by Postgres triggers — see the
 * init migration), merged with trigram title matches for typo tolerance.
 * Only published entries surface: drafts have no docs at all, and archived
 * docs are filtered by the status join here.
 */

export const HL_START = "«";
export const HL_END = "»";
const HEADLINE_OPTS = `StartSel=${HL_START}, StopSel=${HL_END}, MaxWords=18, MinWords=6`;

type Kind = "WHAT" | "WHY" | "HOW" | "WHO" | "WHEN";

type EntryRow = {
  id: string;
  title: string;
  template: "PROCESS" | "FEATURE";
  category: string;
  categorySlug: string;
  subcategory: string;
  rank: number;
};

type SnippetRow = { entryId: string; kind: Kind; order: number; snippet: string };

type SkillRow = {
  id: string;
  entryId: string;
  title: string;
  durationSeconds: number | null;
  transcriptSegments: unknown;
  entryTitle: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  transcriptMatched: boolean;
  snippet: string | null;
};

type TaxonomyRow = {
  name: string;
  href: string;
  detail: string;
  categorySlug: string;
};

function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, "\\$&");
}

// First «marked» term of a headline — the surface form that actually matched.
function firstMarkedTerm(snippet: string | null): string | null {
  if (!snippet) return null;
  const m = snippet.match(new RegExp(`${HL_START}([^${HL_END}]+)${HL_END}`));
  return m ? m[1] : null;
}

function segmentTimestamp(segments: unknown, term: string | null): number | null {
  if (!term || !Array.isArray(segments)) return null;
  const needle = term.toLowerCase();
  for (const seg of segments) {
    if (
      seg &&
      typeof seg === "object" &&
      "t" in seg &&
      "text" in seg &&
      typeof seg.t === "number" &&
      typeof seg.text === "string" &&
      seg.text.toLowerCase().includes(needle)
    ) {
      return seg.t;
    }
  }
  return null;
}

export async function search(q: string): Promise<SearchResponse> {
  const like = `%${escapeLike(q)}%`;

  const [entryRows, skillRows, categoryRows, subcategoryRows] = await Promise.all([
    db.$queryRaw<EntryRow[]>(Prisma.sql`
      WITH tsq AS (SELECT websearch_to_tsquery('english', ${q}) AS q),
      fts AS (
        SELECT d."entryId" AS id, ts_rank_cd(d.tsv, tsq.q) AS rank
        FROM "SearchDoc" d, tsq
        WHERE d."skillId" IS NULL AND d.tsv @@ tsq.q
      ),
      trgm AS (
        SELECT e.id, similarity(e.title, ${q}) * 0.6 AS rank
        FROM "Entry" e
        WHERE e.title % ${q}
      ),
      merged AS (
        SELECT id, max(rank) AS rank
        FROM (SELECT * FROM fts UNION ALL SELECT * FROM trgm) u
        GROUP BY id
      ),
      -- Top-N first on (rank, status) alone; taxonomy joins run for 20
      -- rows, not for every match of a common term.
      top AS (
        SELECT e.id, m.rank, e."updatedAt"
        FROM merged m
        JOIN "Entry" e ON e.id = m.id
        WHERE e.status = 'published'
        ORDER BY m.rank DESC, e."updatedAt" DESC
        LIMIT 20
      )
      SELECT e.id, e.title, e.template::text AS template,
             c.name AS category, c.slug AS "categorySlug",
             s.name AS subcategory, t.rank::float8 AS rank
      FROM top t
      JOIN "Entry" e ON e.id = t.id
      JOIN "Category" c ON c.id = e."categoryId"
      JOIN "Subcategory" s ON s.id = e."subcategoryId"
      ORDER BY t.rank DESC, t."updatedAt" DESC
    `),
    db.$queryRaw<SkillRow[]>(Prisma.sql`
      WITH tsq AS (SELECT websearch_to_tsquery('english', ${q}) AS q),
      fts AS (
        SELECT d."skillId" AS id, ts_rank_cd(d.tsv, tsq.q) AS rank
        FROM "SearchDoc" d, tsq
        WHERE d."skillId" IS NOT NULL AND d.tsv @@ tsq.q
      ),
      trgm AS (
        SELECT sk.id, similarity(sk.title, ${q}) * 0.6 AS rank
        FROM "Skill" sk
        WHERE sk.title % ${q}
      ),
      merged AS (
        SELECT id, max(rank) AS rank
        FROM (SELECT * FROM fts UNION ALL SELECT * FROM trgm) u
        GROUP BY id
      ),
      top AS (
        SELECT sk.id, m.rank
        FROM merged m
        JOIN "Skill" sk ON sk.id = m.id
        JOIN "Entry" e ON e.id = sk."entryId"
        WHERE e.status = 'published'
        ORDER BY m.rank DESC
        LIMIT 10
      )
      -- Headlines and taxonomy only for the 10 winners.
      SELECT sk.id, sk."entryId", sk.title, sk."durationSeconds",
             sk."transcriptSegments", e.title AS "entryTitle",
             c.name AS category, c.slug AS "categorySlug", s.name AS subcategory,
             to_tsvector('english', coalesce(sk.transcript, '')) @@ tsq.q AS "transcriptMatched",
             CASE WHEN to_tsvector('english', coalesce(sk.transcript, '')) @@ tsq.q
                  THEN ts_headline('english', sk.transcript, tsq.q, ${HEADLINE_OPTS})
             END AS snippet
      FROM top t
      JOIN "Skill" sk ON sk.id = t.id
      JOIN "Entry" e ON e.id = sk."entryId"
      JOIN "Category" c ON c.id = e."categoryId"
      JOIN "Subcategory" s ON s.id = e."subcategoryId"
      CROSS JOIN tsq
      ORDER BY t.rank DESC
    `),
    db.$queryRaw<TaxonomyRow[]>(Prisma.sql`
      SELECT c.name, '/c/' || c.slug AS href, c.slug AS "categorySlug",
             (SELECT count(*)::int FROM "Subcategory" s WHERE s."categoryId" = c.id AND s."archivedAt" IS NULL) ||
               CASE WHEN c.kind = 'SOFTWARE' THEN ' modules · ' ELSE ' areas · ' END ||
               (SELECT count(*)::int FROM "Entry" e WHERE e."categoryId" = c.id AND e.status = 'published') ||
               CASE WHEN c.kind = 'SOFTWARE' THEN ' features' ELSE ' processes' END AS detail
      FROM "Category" c
      WHERE c."archivedAt" IS NULL
        AND (c.name ILIKE ${like} OR c.name % ${q})
      ORDER BY similarity(c.name, ${q}) DESC
      LIMIT 5
    `),
    db.$queryRaw<TaxonomyRow[]>(Prisma.sql`
      SELECT c.name || ' › ' || s.name AS name,
             '/c/' || c.slug || '/' || s.slug AS href, c.slug AS "categorySlug",
             (SELECT count(*)::int FROM "Entry" e WHERE e."subcategoryId" = s.id AND e.status = 'published') ||
               CASE WHEN c.kind = 'SOFTWARE' THEN ' features' ELSE ' processes' END AS detail
      FROM "Subcategory" s
      JOIN "Category" c ON c.id = s."categoryId"
      WHERE s."archivedAt" IS NULL AND c."archivedAt" IS NULL
        AND (s.name ILIKE ${like} OR s.name % ${q})
      ORDER BY similarity(s.name, ${q}) DESC
      LIMIT 5
    `),
  ]);

  // Resolve which section matched, for the returned entries only — bounded
  // work on the result page, never at index time. Section bodies first,
  // then block text (workflow steps, SOP items, link titles, filenames)
  // for entries whose hit wasn't in a body.
  const snippets = new Map<string, { kind: Kind; snippet: string }>();
  const ids = entryRows.map((e) => e.id);
  if (ids.length > 0) {
    const bodyRows = await db.$queryRaw<SnippetRow[]>(Prisma.sql`
      WITH tsq AS (SELECT websearch_to_tsquery('english', ${q}) AS q)
      SELECT s."entryId", s.kind::text AS kind, s."order",
             ts_headline('english', s.body, tsq.q, ${HEADLINE_OPTS}) AS snippet
      FROM "Section" s, tsq
      WHERE s."entryId" = ANY(${ids}) AND to_tsvector('english', s.body) @@ tsq.q
      ORDER BY s."entryId", s."order"
    `);
    for (const row of bodyRows) {
      if (!snippets.has(row.entryId)) {
        snippets.set(row.entryId, { kind: row.kind, snippet: row.snippet });
      }
    }
    const unresolved = ids.filter((id) => !snippets.has(id));
    if (unresolved.length > 0) {
      const blockRows = await db.$queryRaw<SnippetRow[]>(Prisma.sql`
        WITH tsq AS (SELECT websearch_to_tsquery('english', ${q}) AS q)
        SELECT s."entryId", s.kind::text AS kind, s."order",
               ts_headline('english', kb_block_text(b.type, b.payload), tsq.q, ${HEADLINE_OPTS}) AS snippet
        FROM "Block" b
        JOIN "Section" s ON s.id = b."sectionId"
        CROSS JOIN tsq
        WHERE s."entryId" = ANY(${unresolved})
          AND to_tsvector('english', coalesce(kb_block_text(b.type, b.payload), '')) @@ tsq.q
        ORDER BY s."entryId", s."order", b."order"
      `);
      for (const row of blockRows) {
        if (!snippets.has(row.entryId)) {
          snippets.set(row.entryId, { kind: row.kind, snippet: row.snippet });
        }
      }
    }
  }

  const entries: EntryHit[] = entryRows.map((row) => {
    const hit = snippets.get(row.id);
    return {
      id: row.id,
      title: row.title,
      template: row.template,
      breadcrumb: `${row.category} › ${row.subcategory}`,
      section: hit?.kind ?? null,
      snippet: hit?.snippet ?? null,
    };
  });

  const skills: SkillHit[] = skillRows.map((row) => ({
    id: row.id,
    entryId: row.entryId,
    title: row.title,
    durationSeconds: row.durationSeconds,
    breadcrumb: `${row.category} › ${row.subcategory} › ${row.entryTitle}`,
    timestamp: row.transcriptMatched
      ? segmentTimestamp(row.transcriptSegments, firstMarkedTerm(row.snippet))
      : null,
    snippet: row.snippet,
  }));

  const categories: CategoryHit[] = [...categoryRows, ...subcategoryRows].map(
    (row) => ({ name: row.name, href: row.href, detail: row.detail }),
  );

  const distinct = new Set<string>([
    ...entryRows.map((r) => r.categorySlug),
    ...skillRows.map((r) => r.categorySlug),
    ...categoryRows.map((r) => r.categorySlug),
    ...subcategoryRows.map((r) => r.categorySlug),
  ]);

  return {
    query: q,
    total: categories.length + entries.length + skills.length,
    categoryCount: distinct.size,
    categories,
    entries,
    skills,
  };
}
