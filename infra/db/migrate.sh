#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration connection}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=infra/db/common.sh
source "$ROOT_DIR/infra/db/common.sh"

# This runner is for a plain PostgreSQL target, and there is a specific reason it
# must not be pointed at a Supabase Cloud project: the platform records applied
# migration versions in `supabase_migrations.schema_migrations`, and applying a
# file from here records nothing there. The schema and the ledger would then
# disagree, and the next `supabase db push` would skip the file it believed was
# already applied — a silent divergence, not an error.
if is_supabase_cloud_url "$DATABASE_ADMIN_URL"; then
  echo "ERROR: DATABASE_ADMIN_URL points at a Supabase Cloud project." >&2
  echo "       migrate.sh does not record applied versions in" >&2
  echo "       supabase_migrations.schema_migrations, so it would leave the schema" >&2
  echo "       and the platform's migration ledger out of step. Use the tracked path:" >&2
  echo "           supabase link --project-ref <ref>   # once" >&2
  echo "           pnpm db:push" >&2
  exit 1
fi

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
  echo "       A Supabase Cloud project has it already; this check exists for a plain" >&2
  echo "       PostgreSQL target, including the CI job, where it has to be created by" >&2
  echo "       hand. See .github/workflows/ci.yml for the shim that does so." >&2
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
