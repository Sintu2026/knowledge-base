# Knowledge Base

Internal knowledge base for Caizen Homes. Next.js 16 (App Router) + Tailwind 4,
Auth.js v5 with Microsoft Entra ID (tenant-locked), PostgreSQL.

## Local development

Prerequisites: Node.js 20+ and a **native PostgreSQL install** (18 recommended) —
Docker is not used. On Windows: the EDB installer from
[postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
or `winget install PostgreSQL.PostgreSQL.18`. Keep port 5432 and note the
`postgres` superuser password you choose.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the dev role and database (one time; prompts for the `postgres`
   superuser password):

   ```bash
   psql -U postgres -c "CREATE ROLE kb LOGIN PASSWORD 'kb' CREATEDB;"
   psql -U postgres -c "CREATE DATABASE kb OWNER kb;"
   ```

   `CREATEDB` is required so `prisma migrate dev` can create its shadow
   database.

3. Configure environment variables — copy `.env.example` to `.env` and fill in
   the auth values. Use `.env` (not `.env.local`): Next.js reads both, but the
   Prisma CLI only reads `.env`. The database URLs for local dev are already
   correct in the example:

   ```
   DATABASE_URL=postgresql://kb:kb@localhost:5432/kb
   DIRECT_URL=postgresql://kb:kb@localhost:5432/kb
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The UI-primitive
   showcase lives at [/kitchen-sink](http://localhost:3000/kitchen-sink).

## Deployment

Netlify with Netlify Database (Neon) attached: `DATABASE_URL` is the pooled
connection string, `DIRECT_URL` the direct one (Prisma migrations need the
direct URL). See `.env.example` for the full variable list, including the
Entra ID app registration values.
