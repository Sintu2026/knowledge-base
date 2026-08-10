/*
 * Search load test (§10): seed 10,000 published entries (plus 1,000 skills
 * with transcripts) into the current database, prove the search queries the
 * API runs stay under 100ms, then clean up after itself.
 *
 *   npm run search:bench
 *   KEEP_LOAD_DATA=1 npm run search:bench   # leave rows in place for EXPLAIN work
 *
 * Corpus realism: benchmark terms are planted with controlled document
 * frequencies (a hot term appears in 12–15% of entries — matching more than
 * a thousand docs at this scale) over a ~20,000-word filler vocabulary, so
 * selectivity behaves like a real knowledge base rather than a 40-word toy
 * vocabulary where every term matches every doc.
 *
 * The SQL below mirrors lib/search.ts (entry and skill queries) — keep them
 * in step if the ranking changes. The two queries run on separate
 * connections, as they do in the app through Prisma's pool.
 */
import "dotenv/config";
import pg from "pg";

const TOTAL_ENTRIES = 10_000;
const TOTAL_SKILLS = 1_000;
const BATCH = 500;
const FILLER_VOCAB = 20_000;

// Deterministic RNG so runs are comparable.
let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const NOUNS = [
  "foundation", "framing", "lumber", "excavation", "insulation", "roofing",
  "siding", "cabinet", "flooring", "grading", "furnace", "survey", "budget",
  "variance", "payroll", "warranty", "deficiency", "closing", "handover",
] as const;
const VERBS = [
  "review", "approve", "submit", "inspect", "order", "receive", "install",
  "record", "verify", "measure", "confirm", "escalate", "prepare", "assign",
] as const;

// Benchmark terms with target document frequencies.
const PLANTED: readonly [word: string, df: number][] = [
  ["invoice", 0.15],
  ["schedule", 0.12],
  ["inspection", 0.12],
  ["reconcile", 0.1],
  ["concrete", 0.08],
  ["template", 0.07],
  ["drywall", 0.05],
  ["holdback", 0.04],
];

function fillerWord(): string {
  const i = Math.floor(rand() * FILLER_VOCAB);
  return `${NOUNS[i % NOUNS.length]}${i.toString(36)}`;
}

function fillerText(words: number): string {
  const parts: string[] = [];
  for (let i = 0; i < words; i++) parts.push(rand() < 0.15 ? pick(VERBS) : fillerWord());
  return parts.join(" ");
}

// Plant terms by document frequency; some appear as the "drywall inspection"
// bigram so the quoted-phrase query has real hits, and "before the draw"
// lands in ~4% for the phrase-with-stopwords case.
function plantedText(): string {
  const parts: string[] = [];
  for (const [word, df] of PLANTED) {
    if (rand() < df) {
      parts.push(word === "drywall" && rand() < 0.5 ? "drywall inspection" : word);
    }
  }
  if (rand() < 0.04) parts.push("before the draw");
  return parts.join(" ");
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const client2 = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function setTriggers(state: "ENABLE" | "DISABLE"): Promise<void> {
  for (const table of ["Entry", "Section", "Skill"]) {
    await client.query(`ALTER TABLE "${table}" ${state} TRIGGER USER`);
  }
}

async function cleanup(): Promise<void> {
  await setTriggers("DISABLE");
  await client.query(`DELETE FROM "Entry" WHERE id LIKE 'lt-e-%'`);
  await client.query(`DELETE FROM "Subcategory" WHERE id = 'lt-sub'`);
  await client.query(`DELETE FROM "Category" WHERE id = 'lt-cat'`);
  await client.query(`DELETE FROM "User" WHERE id = 'lt-user'`);
  await setTriggers("ENABLE");
}

async function main(): Promise<void> {
  await client.connect();
  await client2.connect();
  console.log("Cleaning up any previous run…");
  await cleanup();

  console.log(
    `Seeding ${TOTAL_ENTRIES} entries + ${TOTAL_SKILLS} skills (triggers off during bulk load)…`,
  );
  const t0 = Date.now();
  await setTriggers("DISABLE");

  await client.query(
    `INSERT INTO "User" (id, name, email, "avatarInitials") VALUES ('lt-user', 'Load Test', 'load-test@example.invalid', 'LT')`,
  );
  await client.query(
    `INSERT INTO "Category" (id, name, slug, kind, "order") VALUES ('lt-cat', 'Load test', 'load-test', 'PROCESS', 999)`,
  );
  await client.query(
    `INSERT INTO "Subcategory" (id, "categoryId", name, slug, "order") VALUES ('lt-sub', 'lt-cat', 'Load test', 'load-test', 0)`,
  );

  const KINDS = ["WHAT", "WHY", "HOW", "WHO", "WHEN"] as const;
  for (let start = 0; start < TOTAL_ENTRIES; start += BATCH) {
    const entries: string[] = [];
    const sections: string[] = [];
    for (let n = start; n < Math.min(start + BATCH, TOTAL_ENTRIES); n++) {
      // ~2% of titles carry "schedule template" so the typo query has
      // trigram targets; the rest are filler.
      const title =
        rand() < 0.02
          ? `${pick(VERBS)} the schedule template #${n}`
          : `${pick(VERBS)} the ${pick(NOUNS)} ${fillerWord()} #${n}`;
      entries.push(
        `('lt-e-${n}', ${quote(title)}, ${quote(fillerText(10))}, 'PROCESS', 'lt-cat', 'lt-sub', 'lt-user', 'published', 1, now(), now())`,
      );
      const plantIn = Math.floor(rand() * 3); // planted terms land in one of the first three sections
      for (const [k, kind] of KINDS.entries()) {
        // Varying completeness, like real content.
        let body = k < 3 || rand() < 0.4 ? fillerText(25) : "";
        if (body && k === plantIn) body += " " + plantedText();
        sections.push(`('lt-s-${n}-${k}', 'lt-e-${n}', '${kind}', ${quote(body)}, ${k})`);
      }
    }
    await client.query(
      `INSERT INTO "Entry" (id, title, summary, template, "categoryId", "subcategoryId", "ownerId", status, version, "createdAt", "updatedAt") VALUES ${entries.join(",")}`,
    );
    await client.query(
      `INSERT INTO "Section" (id, "entryId", kind, body, "order") VALUES ${sections.join(",")}`,
    );
  }

  const skills: string[] = [];
  for (let n = 0; n < TOTAL_SKILLS; n++) {
    const entryN = Math.floor(rand() * TOTAL_ENTRIES);
    const transcript =
      fillerText(50) + (rand() < 0.2 ? " reconcile the statement" : "");
    skills.push(
      `('lt-k-${n}', 'lt-e-${entryN}', ${quote(`${pick(VERBS)} ${pick(NOUNS)} recording #${n}`)}, 100, ${quote(transcript)}, ${60 + Math.floor(rand() * 120)})`,
    );
  }
  for (let start = 0; start < skills.length; start += BATCH) {
    await client.query(
      `INSERT INTO "Skill" (id, "entryId", title, "order", transcript, "durationSeconds") VALUES ${skills.slice(start, start + BATCH).join(",")}`,
    );
  }

  await setTriggers("ENABLE");
  console.log(`Seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  console.log("Building search docs with the production refresh function…");
  const t1 = Date.now();
  await client.query(
    `SELECT count(*) FROM (SELECT kb_refresh_entry_doc(id) FROM "Entry" WHERE id LIKE 'lt-e-%') x`,
  );
  await client.query(`ANALYZE "SearchDoc", "Entry", "Skill", "Section"`);
  const docs = await client.query(`SELECT count(*)::int AS n FROM "SearchDoc"`);
  console.log(
    `Indexed in ${((Date.now() - t1) / 1000).toFixed(1)}s — ${docs.rows[0].n} search docs total.`,
  );

  // Mirrors lib/search.ts: top-N on rank and status first, taxonomy joins
  // (and, for skills, ts_headline) only for the winners.
  const ENTRY_SQL = `
    WITH tsq AS (SELECT websearch_to_tsquery('english', $1) AS q),
    fts AS (
      SELECT d."entryId" AS id, ts_rank_cd(d.tsv, tsq.q) AS rank
      FROM "SearchDoc" d, tsq WHERE d."skillId" IS NULL AND d.tsv @@ tsq.q
    ),
    trgm AS (
      SELECT e.id, similarity(e.title, $1) * 0.6 AS rank FROM "Entry" e WHERE e.title % $1
    ),
    merged AS (
      SELECT id, max(rank) AS rank FROM (SELECT * FROM fts UNION ALL SELECT * FROM trgm) u GROUP BY id
    ),
    top AS (
      SELECT e.id, m.rank, e."updatedAt" FROM merged m
      JOIN "Entry" e ON e.id = m.id
      WHERE e.status = 'published'
      ORDER BY m.rank DESC, e."updatedAt" DESC LIMIT 20
    )
    SELECT e.id, e.title, t.rank FROM top t
    JOIN "Entry" e ON e.id = t.id
    JOIN "Category" c ON c.id = e."categoryId"
    JOIN "Subcategory" s ON s.id = e."subcategoryId"
    ORDER BY t.rank DESC, t."updatedAt" DESC`;

  const SKILL_SQL = `
    WITH tsq AS (SELECT websearch_to_tsquery('english', $1) AS q),
    fts AS (
      SELECT d."skillId" AS id, ts_rank_cd(d.tsv, tsq.q) AS rank
      FROM "SearchDoc" d, tsq WHERE d."skillId" IS NOT NULL AND d.tsv @@ tsq.q
    ),
    trgm AS (
      SELECT sk.id, similarity(sk.title, $1) * 0.6 AS rank FROM "Skill" sk WHERE sk.title % $1
    ),
    merged AS (
      SELECT id, max(rank) AS rank FROM (SELECT * FROM fts UNION ALL SELECT * FROM trgm) u GROUP BY id
    ),
    top AS (
      SELECT sk.id, m.rank FROM merged m
      JOIN "Skill" sk ON sk.id = m.id
      JOIN "Entry" e ON e.id = sk."entryId"
      WHERE e.status = 'published'
      ORDER BY m.rank DESC LIMIT 10
    )
    SELECT sk.id, t.rank,
           ts_headline('english', coalesce(sk.transcript, ''), tsq.q) AS snippet
    FROM top t
    JOIN "Skill" sk ON sk.id = t.id
    JOIN "Entry" e ON e.id = sk."entryId"
    JOIN "Category" c ON c.id = e."categoryId"
    JOIN "Subcategory" s ON s.id = e."subcategoryId"
    CROSS JOIN tsq
    ORDER BY t.rank DESC`;

  const QUERIES: [string, string][] = [
    ["hot word (~15% of docs)", "invoice"],
    ["two hot words", "concrete inspection"],
    ["quoted phrase", '"drywall inspection"'],
    ["phrase with stopwords", "before the draw"],
    ["typo (trigram path)", "review the shedule template"],
    ["transcript-heavy word", "reconcile"],
  ];

  console.log(`\nBenchmark (20 runs each after 3 warmups, corpus ${TOTAL_ENTRIES}+ entries):`);
  let worstP95 = 0;
  for (const [label, q] of QUERIES) {
    for (let i = 0; i < 3; i++) {
      await Promise.all([client.query(ENTRY_SQL, [q]), client2.query(SKILL_SQL, [q])]);
    }
    const times: number[] = [];
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const [e] = await Promise.all([
        client.query(ENTRY_SQL, [q]),
        client2.query(SKILL_SQL, [q]),
      ]);
      times.push(performance.now() - start);
      hits = e.rowCount ?? 0;
    }
    times.sort((a, b) => a - b);
    const p95 = percentile(times, 95);
    worstP95 = Math.max(worstP95, p95);
    console.log(
      `  ${label.padEnd(26)} ${`"${q}"`.padEnd(24)} p50 ${percentile(times, 50).toFixed(1).padStart(5)}ms  p95 ${p95.toFixed(1).padStart(5)}ms  max ${times[times.length - 1].toFixed(1).padStart(5)}ms  (top ${hits})`,
    );
  }

  if (process.env.KEEP_LOAD_DATA === "1") {
    console.log("\nKEEP_LOAD_DATA=1 — leaving load-test rows in place (rerun to clean up).");
  } else {
    console.log("\nCleaning up load-test rows…");
    await cleanup();
    await client.query(`ANALYZE "SearchDoc", "Entry"`);
  }
  await client.end();
  await client2.end();

  if (worstP95 > 100) {
    console.error(`\nFAIL: worst p95 ${worstP95.toFixed(1)}ms exceeds the 100ms target.`);
    process.exit(1);
  }
  console.log(`\nPASS: worst p95 ${worstP95.toFixed(1)}ms — under the 100ms target.`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanup();
  } catch {
    console.error("Cleanup failed too — rerun the script to retry cleanup.");
  }
  await client.end();
  await client2.end();
  process.exit(1);
});
