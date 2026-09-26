#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration connection}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Two preconditions are checked in one round trip, and an unreachable database
# is reported as such rather than being mistaken for a missing catalog.
#
#   1. auth.users must exist. The baseline declares foreign keys into
#      auth.users(id), and that table belongs to the platform's Auth bootstrap
#      rather than to these migrations, so a plain PostgreSQL target will not
#      have it and the baseline would abort on the first such reference.
#   2. hims_core must be absent. This runner replays every file in order and is
#      not incremental, so applying it to a database that already holds part of
#      the chain fails on the first already-existing relation.
#
# Reporting both up front beats failing part way through the baseline.
state="$(psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -tA -F '|' -c "
  SELECT
    (SELECT count(*)
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth' AND c.relname = 'users' AND c.relkind = 'r'),
    (SELECT count(*)
       FROM information_schema.tables
      WHERE table_schema = 'hims_core' AND table_name = 'tenants');")" || state=""

if [ -z "$state" ]; then
  echo "ERROR: cannot reach the target database with DATABASE_ADMIN_URL." >&2
  exit 1
fi

IFS='|' read -r has_auth_users has_hims_schema <<< "$state"

if [ "$has_auth_users" != "1" ]; then
  echo "ERROR: auth.users is missing from the target database." >&2
  echo "       The HIMS baseline references auth.users(id) for user identity." >&2
  echo "       Start the Supabase stack (bash infra/supabase/bootstrap.sh, then" >&2
  echo "       'docker compose ... up -d --wait') so its Auth bootstrap creates the" >&2
  echo "       catalog, or create it yourself against a plain PostgreSQL target." >&2
  exit 1
fi

if [ "$has_hims_schema" != "0" ]; then
  echo "ERROR: hims_core.tenants already exists in the target database." >&2
  echo "       migrate.sh replays the whole chain and is not incremental; it cannot" >&2
  echo "       be re-run over a database that has already been migrated. Use" >&2
  echo "       'pnpm db:reset' to rebuild a development database from scratch." >&2
  exit 1
fi

shopt -s nullglob
migrations=( "$ROOT_DIR"/supabase/migrations/*.sql )
if (( ${#migrations[@]} == 0 )); then
  echo "No migrations found" >&2
  exit 1
fi

for migration in "${migrations[@]}"; do
  echo "Applying $(basename "$migration")"
  psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Migration pipeline completed."
