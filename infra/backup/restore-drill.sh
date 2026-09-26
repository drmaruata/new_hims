#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to an administrator connection}"
: "${BACKUP_FILE:?Set BACKUP_FILE to a .dump archive}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL to the isolated restore database connection}"
: "${ALLOW_DESTRUCTIVE_RESTORE:?Set ALLOW_DESTRUCTIVE_RESTORE=YES to run a restore drill}"

if [[ "$ALLOW_DESTRUCTIVE_RESTORE" != "YES" ]]; then
  echo "Refusing restore without ALLOW_DESTRUCTIVE_RESTORE=YES" >&2
  exit 1
fi

TARGET_DB="${TARGET_DB:-hims_restore_drill}"
if [[ ! "$TARGET_DB" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "TARGET_DB contains unsafe characters" >&2
  exit 1
fi

echo "Recreating isolated restore database: $TARGET_DB"
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);"
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DB\" TEMPLATE template0;"

echo "Restoring $BACKUP_FILE"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" "$BACKUP_FILE"

echo "Running restore verification"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database();
SELECT count(*) AS hims_tables
FROM information_schema.tables
WHERE table_schema LIKE 'hims_%';

SELECT count(*) AS rls_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname LIKE 'hims_%'
  AND c.relkind = 'r'
  AND c.relrowsecurity;
SQL

echo "Restore drill completed successfully. The isolated database remains available for inspection."
