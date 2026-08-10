# Knowledge Base

Setup guides and runbooks for local development.

## Contents

| Doc | What it covers |
|-----|----------------|
| [docs/local-development.md](docs/local-development.md) | Local development on **native PostgreSQL** (no Docker) — install, database bootstrap, `.env.local`, and how to strip Docker assumptions out of a project |

## Quick start (TL;DR)

Docker Desktop is **not** used for local development. Postgres runs as a native
Windows service instead.

1. Install PostgreSQL 18 for Windows (EDB installer or `winget install PostgreSQL.PostgreSQL.18`).
2. Bootstrap the dev database: `powershell -File scripts/setup-db.ps1`
   (creates role `app` / password `localdev` and database `app_dev`).
3. Copy `.env.local.example` to your project's `.env.local`:

   ```
   DATABASE_URL=postgresql://app:localdev@localhost:5432/app_dev
   ```

4. Run your project's migrations/seed, then `npm run dev` as usual.

Full details, verification steps, and troubleshooting: [docs/local-development.md](docs/local-development.md).
