-- Bootstrap the local development role and database on native PostgreSQL.
-- Idempotent: safe to re-run. Run as the postgres superuser:
--   psql -U postgres -f scripts/setup-db.sql
-- Override the defaults with -v, e.g.:
--   psql -U postgres -v dbname=caizenx_dev -f scripts/setup-db.sql

\if :{?appuser}
\else
  \set appuser app
\endif
\if :{?apppassword}
\else
  \set apppassword localdev
\endif
\if :{?dbname}
\else
  \set dbname app_dev
\endif

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'appuser', :'apppassword')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'appuser')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'dbname', :'appuser')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'dbname')
\gexec

-- Uncomment if the project's migrations expect these extensions:
-- \connect :"dbname"
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT format('Done. Connection string: postgresql://%s:<password>@localhost:5432/%s',
              :'appuser', :'dbname') AS result;
