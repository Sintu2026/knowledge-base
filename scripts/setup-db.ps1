# Bootstrap the local development role and database on native PostgreSQL.
# Idempotent: safe to re-run. Prompts for the postgres superuser password.
#
#   powershell -File scripts/setup-db.ps1
#   powershell -File scripts/setup-db.ps1 -DbName caizenx_dev
param(
    [string]$AppUser = 'app',
    [string]$AppPassword = 'localdev',
    [string]$DbName = 'app_dev',
    [string]$SuperUser = 'postgres',
    [string]$PgHost = 'localhost',
    [int]$Port = 5432
)

$ErrorActionPreference = 'Stop'

# Find psql: PATH first, then default install locations (newest version wins).
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) {
    Write-Error "psql not found. Install PostgreSQL first (see docs/local-development.md, Step 1)."
}

$sql = Join-Path $PSScriptRoot 'setup-db.sql'
& $psql -U $SuperUser -h $PgHost -p $Port -d postgres -v ON_ERROR_STOP=1 `
    -v "appuser=$AppUser" -v "apppassword=$AppPassword" -v "dbname=$DbName" `
    -f $sql
if ($LASTEXITCODE -ne 0) { Write-Error "setup-db.sql failed (exit $LASTEXITCODE)." }

Write-Host ""
Write-Host "Database ready. Put this in your project's .env.local:" -ForegroundColor Green
Write-Host "  DATABASE_URL=postgresql://${AppUser}:${AppPassword}@${PgHost}:${Port}/${DbName}"
