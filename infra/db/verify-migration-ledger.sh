#!/usr/bin/env bash
set -euo pipefail

# Compares the local migration filenames against the platform's applied-migration
# ledger, and refuses to let `supabase db push` run against a ledger that has
# drifted out of step with the files.
#
# ## Why this exists
#
# There are two ways to apply a migration to the linked cloud project, and they
# record the version differently:
#
#   * `supabase db push` takes the version from the filename, so the ledger
#     always agrees with supabase/migrations/ by construction.
#
#   * The Supabase MCP server's `apply_migration` calls the platform endpoint
#     POST /v1/projects/{ref}/database/migrations, which accepts only a name and
#     a body and stamps the version as the current time. It cannot be told which
#     version to use.
#
# So a migration applied through the MCP lands in the ledger as, say,
# 20260926132031 while its file is named 20260925000000_hims_baseline.sql. That
# is not cosmetic: `db push` applies every filename absent from the ledger, so it
# would try to run the file a second time and fail on the first CREATE TABLE that
# already exists.
#
# A drifted ledger is also worse than a merely broken one. Someone who reacts to
# that failure by deleting the ledger row has thrown away the only record of what
# the database actually contains, and the next push re-applies the whole chain.
#
# ## What this does and does not do
#
# Read-only by default. --reconcile is the only mode that writes, push-migrations.sh
# never passes it, and it only ever renames a version to match the file that
# declares it. It cannot mark an unapplied migration as applied, it refuses to
# reuse an occupied version, and it aborts unless it renames exactly the number
# of rows it found drifted.
#
# This script reads DATABASE_ADMIN_URL because the ledger is platform-owned and
# the application role has no business reading it. Reading it cannot apply a
# migration, so it does not weaken the invariant push-migrations.sh protects by
# not using that URL -- that script's concern is writes.
#
# psql runs in a single transaction (-1) so the temporary tables below survive
# long enough to be used, and so a failed check leaves nothing half-done.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"

usage() {
  cat <<'USAGE'
Usage: verify-migration-ledger.sh [--reconcile]

  (no flag)   Report pending, applied, drifted and orphaned migrations.
              Exits non-zero if the ledger has drifted or holds orphans.
              Pending migrations are normal and do not fail the check.

  --reconcile Rename a drifted ledger version to the version in its own
              filename. Refuses if a target version is already taken, and
              refuses unless it renames exactly the number of rows it found
              drifted, so a partial or surprising ledger stops the run instead
              of being half-repaired.
USAGE
}

RECONCILE=0
case "${1:-}" in
  "") ;;
  --reconcile) RECONCILE=1 ;;
  -h|--help) usage; exit 0 ;;
  *) echo "ERROR: unknown argument: $1" >&2; echo >&2; usage >&2; exit 2 ;;
esac

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: no migrations directory at $MIGRATIONS_DIR" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  # A missing psql downgrades this to advice. `db push` still fails loudly on its
  # own when a migration is genuinely unapplied, so skipping the guard costs a
  # clear error rather than a silent one.
  echo "WARNING: psql is not on PATH, so the migration ledger was not checked." >&2
  echo "         Install PostgreSQL, or the Supabase CLI's bundled psql, to enable it." >&2
  exit 0
fi

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration/admin connection}"

# Collect the filenames into two comma-separated lists -- versions and names --
# so they can be handed to SQL through psql variables. psql interpolates
# :variables in ordinary SQL but not inside a dollar-quoted string, so these are
# consumed by string_to_array() in plain statements.
local_versions=""
local_names=""
shopt -s nullglob
for file in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  local_versions="${local_versions:+$local_versions,}$version"
  local_names="${local_names:+$local_names,}$name"
done
shopt -u nullglob

if [ -z "$local_versions" ]; then
  echo "ERROR: no .sql files in $MIGRATIONS_DIR" >&2
  exit 1
fi

psql "$DATABASE_ADMIN_URL" \
  -X -1 \
  -v ON_ERROR_STOP=1 \
  -v local_versions="$local_versions" \
  -v local_names="$local_names" \
  -v do_reconcile="$RECONCILE" \
  <<'SQL'
-- Checked before anything references the ledger, so a connection to the wrong
-- database reports that, rather than a bare "relation does not exist".
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata
                 WHERE schema_name = 'supabase_migrations') THEN
    RAISE EXCEPTION
      'no supabase_migrations schema on this connection. DATABASE_ADMIN_URL is not pointing at the linked Supabase Cloud project, so there is no ledger to check.';
  END IF;
END
$guard$;

-- The local inventory arrives as two aligned lists. Pairing them back into rows
-- here means nothing downstream has to re-parse a filename.
CREATE TEMP TABLE local_migrations (version text PRIMARY KEY, name text) ON COMMIT DROP;
INSERT INTO local_migrations (version, name)
SELECT v, n
FROM unnest(string_to_array(:'local_versions', ',')) WITH ORDINALITY AS t(v, ord)
JOIN unnest(string_to_array(:'local_names',   ',')) WITH ORDINALITY AS u(n, ord)
  ON u.ord = t.ord;

SELECT set_config('hims.reconcile', :'do_reconcile', false);

-- A ledger row is DRIFTED when its name is a local migration but its version is
-- not: the platform recorded it under a timestamp the file does not use. That is
-- the signature of a migration applied through the MCP.
-- A ledger row is ORPHANED when no local file declares that name at all, which
-- means the file was renamed or deleted after being applied. Those are not
-- repairable by renaming and must be resolved by hand.
-- A local file with no ledger row is PENDING, which is what db push is for.
CREATE TEMP TABLE ledger_state ON COMMIT DROP AS
SELECT
  l.version AS local_version,
  l.name    AS local_name,
  r.version AS ledger_version,
  CASE
    WHEN r.version IS NULL          THEN 'pending'
    WHEN r.version <> l.version     THEN 'drifted'
    ELSE 'applied'
  END       AS status,
  true      AS repairable
FROM local_migrations l
LEFT JOIN supabase_migrations.schema_migrations r ON r.name = l.name
UNION ALL
SELECT NULL, r.name, r.version, 'orphaned', false
FROM supabase_migrations.schema_migrations r
WHERE NOT EXISTS (SELECT 1 FROM local_migrations l WHERE l.name = r.name);

\echo ''
\echo 'Migration ledger'
\echo '----------------'
SELECT status, count(*) AS count FROM ledger_state GROUP BY status ORDER BY status;
\echo ''
SELECT COALESCE(local_version, ledger_version) AS version,
       local_name AS name,
       status,
       CASE WHEN ledger_version IS DISTINCT FROM local_version
            THEN ledger_version ELSE '-' END AS recorded_as
FROM ledger_state
ORDER BY (local_version IS NULL), local_version, ledger_version;

DO $check$
DECLARE
  drifted  bigint := (SELECT count(*) FROM ledger_state WHERE status = 'drifted');
  orphaned bigint := (SELECT count(*) FROM ledger_state WHERE status = 'orphaned');
  pending  bigint := (SELECT count(*) FROM ledger_state WHERE status = 'pending');
  applied  bigint := (SELECT count(*) FROM ledger_state WHERE status = 'applied');
  repaired bigint := 0;
BEGIN
  IF drifted = 0 AND orphaned = 0 THEN
    RAISE NOTICE 'Ledger is in step with the files: % applied, % pending.', applied, pending;
    RETURN;
  END IF;

  IF current_setting('hims.reconcile', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION
      E'% drifted and % orphaned ledger row(s), % pending.\n'
      'The ledger and supabase/migrations/ disagree, so `supabase db push` would try to\n'
      're-apply a migration that is already in the database and fail on the first object\n'
      'that already exists. Repair the drift, then re-run:\n'
      '    bash infra/db/verify-migration-ledger.sh --reconcile\n'
      'Do not delete ledger rows to clear this: that discards the only record of what\n'
      'the database actually contains.',
      drifted, orphaned, pending;
  END IF;

  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'refusing to reconcile: % ledger row(s) have no matching migration file. Those are renamed or deleted files, not version drift, and renaming cannot fix them. Resolve them by hand.',
      orphaned;
  END IF;

  -- Refuse before writing rather than after: renaming onto an occupied version
  -- would collide on the primary key, or make two migrations look like one.
  IF EXISTS (
    SELECT 1
    FROM ledger_state d
    JOIN local_migrations l ON l.name = d.local_name
    WHERE d.status = 'drifted'
      AND EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations x
                   WHERE x.version = l.version)
  ) THEN
    RAISE EXCEPTION
      'refusing to reconcile: a drifted migration''s target version is already in the ledger. Resolve that by hand.';
  END IF;

  -- One statement, so ROW_COUNT covers every row and the equality check below is
  -- meaningful. Filtering on the currently-recorded version as well as the name
  -- means a concurrent write between the report and this statement shows up as a
  -- row count mismatch instead of a silent partial repair.
  UPDATE supabase_migrations.schema_migrations r
  SET version = d.local_version
  FROM ledger_state d
  WHERE d.repairable
    AND d.status = 'drifted'
    AND r.version = d.ledger_version
    AND r.name  = d.local_name;

  GET DIAGNOSTICS repaired = ROW_COUNT;

  IF repaired <> drifted THEN
    RAISE EXCEPTION
      'refusing to finish: expected to rename % row(s) but renamed %; the ledger changed underneath the statement.',
      drifted, repaired;
  END IF;

  RAISE NOTICE 'Reconciled % ledger version(s) to their migration filenames.', repaired;
  RAISE WARNING 'This wrote to supabase_migrations.schema_migrations. Confirm it with: bash infra/db/verify-migration-ledger.sh';
END
$check$;
SQL
