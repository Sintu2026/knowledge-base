# Local development on native PostgreSQL (no Docker)

Docker Desktop's WSL 2 backend fails to initialize on the dev machine, so local
development uses a **native Windows PostgreSQL install** instead of a
`docker compose` Postgres container. This guide replaces any previous
Docker-based setup instructions.

Native Postgres is a good trade anyway: it starts with Windows as a service,
uses less RAM than the WSL 2 VM, and removes Docker Desktop as a dependency
entirely.

---

## Step 1 — Install PostgreSQL 18 (Windows)

**Option A — EDB installer (recommended, you choose the password explicitly):**

1. Download the PostgreSQL 18 x86-64 Windows installer from
   <https://www.postgresql.org/download/windows/>.
2. Run it. Accept the defaults, with these notes:
   - Components: **PostgreSQL Server** and **Command Line Tools** are required;
     pgAdmin is optional; **Stack Builder is not needed** (uncheck it).
   - **Password**: this is the `postgres` superuser password — pick one and
     write it down. You'll need it once in Step 2.
   - **Port**: keep `5432`.
   - Locale: default is fine.
3. The installer registers a Windows service (`postgresql-x64-18`) that starts
   automatically on boot.

**Option B — winget (scriptable):**

```powershell
winget install --id PostgreSQL.PostgreSQL.18 -e
```

This runs the same EDB installer unattended. If you don't know what superuser
password an unattended install set, prefer Option A — knowing the `postgres`
password is required for Step 2.

**Add `psql` to PATH** (the installer doesn't always do this):

```powershell
setx PATH "$env:PATH;C:\Program Files\PostgreSQL\18\bin"
```

Open a **new** terminal and verify:

```powershell
psql --version     # psql (PostgreSQL) 18.x
```

---

## Step 2 — Create the dev role and database

Run the bootstrap script from the repo root (it prompts once for the
`postgres` superuser password from Step 1):

```powershell
powershell -File scripts/setup-db.ps1
```

It is idempotent (safe to re-run) and creates:

| Object   | Value      |
|----------|------------|
| Role     | `app` (login), password `localdev` |
| Database | `app_dev`, owned by `app` |

> Different project, different database? Re-run with parameters:
> `powershell -File scripts/setup-db.ps1 -DbName caizenx_dev -AppUser app`
> The plain-SQL equivalent lives in `scripts/setup-db.sql` if you'd rather run
> `psql -U postgres -f scripts/setup-db.sql` directly (macOS/Linux included).

Verify you can connect as the app role:

```powershell
psql "postgresql://app:localdev@localhost:5432/app_dev" -c "select version();"
```

---

## Step 3 — Configure `.env.local`

In your project root, copy `.env.local.example` (or add to your existing
`.env.local`):

```dotenv
DATABASE_URL=postgresql://app:localdev@localhost:5432/app_dev
```

Notes:

- Some stacks want the pieces split out instead of a URL:

  ```dotenv
  PGHOST=localhost
  PGPORT=5432
  PGUSER=app
  PGPASSWORD=localdev
  PGDATABASE=app_dev
  ```

- `.env.local` is for your machine only — keep it gitignored. Commit
  `.env.local.example` instead.
- These are throwaway local credentials; never reuse them anywhere real.

---

## Step 4 — Run migrations and start the app

Whatever the project used to run *after* `docker compose up` still applies —
only the database it points at changed:

```bash
npm install
npm run db:migrate   # or: npx prisma migrate dev / npx drizzle-kit push / etc.
npm run db:seed      # if the project has seed data
npm run dev
```

---

## Step 5 — Strip Docker assumptions out of a project

When migrating a project off Docker, sweep for these and update them:

1. **Delete** `docker-compose.yml` / `compose.yaml` / `Dockerfile.dev` (keep any
   Dockerfile used only for production deploys — this change is about local dev).
2. **`package.json` scripts** — remove/replace anything that shells out to
   Docker, e.g.:
   - `"db:up": "docker compose up -d db"` → delete (Postgres is always running
     as a Windows service).
   - a `predev` hook that starts containers → delete.
   - `"db:reset"` that ran `docker compose down -v` →
     `psql -U postgres -c "DROP DATABASE IF EXISTS app_dev WITH (FORCE);"` then
     re-run `scripts/setup-db.ps1` and migrations.
3. **Makefile / shell scripts** — same treatment for `docker` / `docker compose`
   targets.
4. **README setup section** — point it at this guide (install native Postgres,
   run `scripts/setup-db.ps1`, set `DATABASE_URL`).
5. **`.env*` files** — hostnames like `db`, `postgres`, or `host.docker.internal`
   become `localhost`. Credentials become the ones from Step 2.
6. **CI is unaffected** — GitHub Actions `services: postgres:` blocks run on the
   runner, not your machine; leave them alone.

---

## Managing the Postgres service

```powershell
Get-Service postgresql*                    # status
Restart-Service postgresql-x64-18          # restart (elevated terminal)
Stop-Service postgresql-x64-18             # stop
```

Or use `services.msc` (GUI). Data lives in
`C:\Program Files\PostgreSQL\18\data`; server config is `postgresql.conf` and
auth config is `pg_hba.conf` in that directory.

---

## Troubleshooting

- **`psql: command not found`** — PATH wasn't updated; re-run the `setx` line in
  Step 1 and open a new terminal.
- **`password authentication failed for user "postgres"`** — wrong superuser
  password. If it's lost: edit `pg_hba.conf`, change `scram-sha-256` to `trust`
  on the `127.0.0.1/32` line, restart the service, run
  `psql -U postgres -c "ALTER USER postgres PASSWORD 'newpassword';"`, revert
  `pg_hba.conf`, restart again.
- **Port 5432 already in use** — check `netstat -ano | findstr :5432`. A
  leftover Postgres (or Docker) process owns it; stop it, or install/configure
  Postgres on another port and change the port in `DATABASE_URL`.
- **App can't connect but `psql` can** — make sure the app connects to
  `localhost`, not a Docker-era hostname like `db` or `host.docker.internal`.
- **Supabase note** — `supabase start` (local Supabase stack) requires Docker
  and won't work on this machine. Projects using the Supabase *client*
  (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) should point at
  the **hosted** Supabase project instead — no Docker needed. Anything that
  talks straight Postgres uses the native install above.

---

## Uninstalling Docker Desktop (optional cleanup)

Once nothing depends on it: Settings → Apps → uninstall **Docker Desktop**,
then optionally reclaim WSL disk space with `wsl --unregister docker-desktop`
(and `wsl --unregister docker-desktop-data` if present).
