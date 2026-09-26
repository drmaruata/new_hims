#!/usr/bin/env bash
set -euo pipefail

# Destroys and rebuilds the HIMS schema in a development database.
#
# This drops schemas rather than the whole database on purpose. The target is
# normally the same database the platform's own Auth/Storage bootstrap lives in,
# and dropping it would take that state with it; it would also make the reset
# impossible whenever the target *is* the only connectable database, because a
# session cannot drop the database it is attached to.
#
# It is irreversible and therefore requires an explicit confirmation.

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration/admin connection}"
: "${HIMS_DB_APP_PASSWORD:?Set HIMS_DB_APP_PASSWORD to a strong per-environment password}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=infra/db/common.sh
source "$ROOT_DIR/infra/db/common.sh"

# A cloud project has exactly one correct way to be rebuilt, and it is the
# platform's, not this one. `supabase db reset --linked` drops and recreates the
# database and clears the migration ledger in the same operation, so the schema
# and `supabase_migrations.schema_migrations` cannot drift apart. Dropping the
# `hims_*` schemas and replaying with migrate.sh would leave every version
# recorded as applied against a database that no longer contains it, and the next
# `supabase db push` would apply nothing at all — reporting success.
#
# Deliberately not overridable by HIMS_ALLOW_REMOTE_RESET. That flag authorises
# resetting a remote *throwaway*; using it here would be a way to desynchronise
# a real project, which is a different mistake and not one worth a flag.
if is_supabase_cloud_url "$DATABASE_ADMIN_URL"; then
  echo "ERROR: DATABASE_ADMIN_URL points at a Supabase Cloud project." >&2
  echo "       db:reset cannot rebuild one: it would drop the hims_* schemas without" >&2
  echo "       clearing supabase_migrations.schema_migrations, leaving the platform" >&2
  echo "       to believe the whole chain is applied to a database that is missing" >&2
  echo "       it. Use the platform's own reset instead, which is atomic:" >&2
  echo "           supabase db reset --linked" >&2
  echo "       That destroys every table in the project, not just the HIMS ones." >&2
  exit 1
fi

if [ "${HIMS_DB_RESET_CONFIRM:-}" != "1" ]; then
  echo "ERROR: db:reset drops every hims_* schema and all data in them." >&2
  echo "       Re-run with HIMS_DB_RESET_CONFIRM=1 to proceed." >&2
  exit 1
fi

case "${DATABASE_ADMIN_URL}" in
  *@localhost:*|*@127.0.0.1:*|*@\[::1\]:*|*@postgres:*) ;;
  *)
    if [ "${HIMS_ALLOW_REMOTE_RESET:-}" != "1" ]; then
      echo "ERROR: refusing to reset a non-local database." >&2
      echo "       DATABASE_ADMIN_URL does not point at localhost. Set" >&2
      echo "       HIMS_ALLOW_REMOTE_RESET=1 only for a throwaway target." >&2
      exit 1
    fi
    ;;
esac

echo "Dropping HIMS schemas in the target database..."
# The list is read from the catalog rather than repeated here, so a schema added
# by a future migration is cleaned up without editing this script. The underscore
# is escaped so the pattern matches the hims_ prefix and not any xhims name.
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT format('DROP SCHEMA IF EXISTS %I CASCADE;', nspname)
FROM pg_namespace
WHERE nspname LIKE 'hims\_%'
\gexec
SQL

bash "$ROOT_DIR/infra/db/migrate.sh"
bash "$ROOT_DIR/infra/db/seed.sh"
bash "$ROOT_DIR/infra/db/provision-app-role.sh"

echo
echo "Reset complete: schemas rebuilt, seed re-applied, application role re-provisioned."
echo "Tenant isolation is not re-checked here because that needs HIMS_TENANT_ID."
echo "Verify it with: HIMS_TENANT_ID=<uuid> bash infra/db/verify-rls.sh"
