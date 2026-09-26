#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration/admin connection}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=infra/db/common.sh
source "$ROOT_DIR/infra/db/common.sh"

# The seed creates a demo tenant. That is a development-only convenience, so it
# is an explicit step rather than something a database bootstrap does on its own,
# and it refuses to run against a remote host unless the operator says so. This
# replaces the old Compose overlay that mounted the seed as a Postgres init
# script, which applied demo tenant data to whatever volume it was started
# against, including a pilot or production one.
case "${DATABASE_ADMIN_URL}" in
  *@localhost:*|*@127.0.0.1:*|*@\[::1\]:*|*@postgres:*) ;;
  *)
    if [ "${HIMS_ALLOW_REMOTE_SEED:-}" != "1" ]; then
      echo "ERROR: refusing to seed a non-local database." >&2
      echo "       DATABASE_ADMIN_URL does not point at localhost. Seeding creates a" >&2
      echo "       demo tenant and must never reach a shared or production database." >&2
      echo "       On a Supabase Cloud project this is expected to stop, because the" >&2
      echo "       project holds real patient data. If this project is a development" >&2
      echo "       one, opt in with:" >&2
      echo "           HIMS_ALLOW_REMOTE_SEED=1 pnpm db:seed" >&2
      exit 1
    fi
    ;;
esac

# Distinguish "cannot connect" from "schema absent", so a bad DATABASE_ADMIN_URL
# is not reported as a missing migration.
state="$(psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -tAc "
  SELECT count(*)
    FROM information_schema.tables
   WHERE table_schema = 'hims_core' AND table_name = 'tenants';")" || state=""

if [ -z "$state" ]; then
  echo "ERROR: cannot reach the target database with DATABASE_ADMIN_URL." >&2
  exit 1
fi

if [ "$state" = "0" ]; then
  # The two platforms apply migrations through different commands, and sending an
  # operator to the wrong one costs them a confusing failure: migrate.sh
  # refuses a cloud target outright.
  if is_supabase_cloud_url "$DATABASE_ADMIN_URL"; then
    echo "ERROR: the HIMS schema is not present. Run 'pnpm db:push' first." >&2
  else
    echo "ERROR: the HIMS schema is not present. Run 'pnpm db:migrate' first." >&2
  fi
  exit 1
fi

echo "Applying supabase/seed/seed.sql"
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/seed/seed.sql"

echo "Seed applied. This is development data; never run it against production."
