/*
 * Doctor for "the app can't reach the database" — most usefully when psql
 * or `prisma db seed` work but the app itself fails.
 *
 * Connects with the same driver (pg) and the same env-file precedence the
 * Next.js dev server uses: .env.local overrides .env. The Prisma CLI reads
 * only .env (via prisma.config.ts), so a stale .env.local makes migrations
 * succeed while the app fails — this script names that split.
 *
 *   npm run db:check
 */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

function parseEnvFile(path) {
  const vars = {};
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    vars[match[1]] = value;
  }
  return vars;
}

function redact(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<not a parseable URL>";
  }
}

const env = parseEnvFile(".env");
const envLocal = parseEnvFile(".env.local");

const fromEnv = env?.DATABASE_URL;
const fromEnvLocal = envLocal?.DATABASE_URL;
// Next.js precedence in dev: .env.local wins over .env.
const effective = fromEnvLocal ?? fromEnv;

console.log(".env          →", fromEnv ? redact(fromEnv) : env ? "no DATABASE_URL" : "file missing");
console.log(".env.local    →", fromEnvLocal ? redact(fromEnvLocal) : envLocal ? "no DATABASE_URL" : "file missing");

if (!effective) {
  console.error("\nNo DATABASE_URL found. Copy .env.example to .env and set it.");
  process.exit(1);
}

if (fromEnvLocal && fromEnv && fromEnvLocal !== fromEnv) {
  console.warn(
    "\n.env.local overrides .env in the app, but the Prisma CLI reads only .env." +
      "\nThese disagree — migrations and the app are talking to different databases." +
      "\nFix: keep DATABASE_URL in .env only, and remove it from .env.local.",
  );
}

console.log("\nApp will connect to:", redact(effective));

const client = new pg.Client({ connectionString: effective });
try {
  await client.connect();
} catch (error) {
  console.error("\nConnection failed:", error.message);
  console.error(
    "\nThings that produce this:" +
      "\n  - Postgres not running, or on a different port (the Windows installer" +
      "\n    picks 5433 when 5432 was taken — check with: netstat -ano | findstr LISTENING | findstr 543)" +
      "\n  - 'localhost' resolving to ::1 while Postgres listens on IPv4 only —" +
      "\n    try 127.0.0.1 in DATABASE_URL" +
      "\n  - wrong password for the kb role (see README bootstrap)",
  );
  process.exit(1);
}

const version = await client.query("select version(), current_database(), current_user");
const row = version.rows[0];
console.log("Connected:", row.version.split(",")[0]);
console.log("Database:", row.current_database, "as", row.current_user);

try {
  const counts = await client.query(
    'select (select count(*) from "User") as users, (select count(*) from "Entry") as entries, (select count(*) from "SearchDoc") as docs',
  );
  const c = counts.rows[0];
  console.log(`Tables OK — ${c.users} users, ${c.entries} entries, ${c.docs} search docs.`);
} catch {
  console.error(
    "\nConnected, but the schema is missing — this database has no migrations." +
      "\nThe CLI migrated a different database than the app connects to (see the" +
      "\n.env/.env.local lines above), or migrations never ran: npm run db:migrate",
  );
  process.exit(1);
}

await client.end();
console.log("\nAll good — the app can use this database.");
