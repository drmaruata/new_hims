#!/usr/bin/env bash
set -euo pipefail

# Applies pending migrations to the linked Supabase Cloud project.
#
# ## Why this wraps the Supabase CLI instead of replaying SQL
#
# `infra/db/migrate.sh` is not incremental: it applies every file in
# supabase/migrations in filename order and refuses a database that already
# holds part of the chain, so it can only ever run once per database. A cloud
# project is long-lived and will be migrated many times, so the platform's
# tracked path is the right one. `supabase db push` records each applied version
# in `supabase_migrations.schema_migrations` and applies only files absent from
# it, which is what makes re-running safe.
#
# The CLI also owns the connection details, so this script deliberately does not
# read DATABASE_ADMIN_URL. Mixing the two would allow a migration to be applied
# as an untracked plain-SQL replay and break the ledger invariant the guard in
# infra/db/migrate.sh exists to protect.
#
# ## First run
#
#   supabase login
#   supabase link --project-ref <your-project-ref>
#
# `link` writes the project ref into supabase/config.toml. In CI, set
# `SUPABASE_DB_PASSWORD` and run `supabase link` non-interactively rather than
# passing --password on the command line, where it would be visible in the
# process list.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: the Supabase CLI is not on PATH." >&2
  echo "       Install it with 'npm install -g supabase' (or see" >&2
  echo "       https://supabase.com/docs/guides/cli), then re-run this command." >&2
  exit 1
fi

# Refuse an unlinked checkout rather than letting the CLI create a new local
# project. `db push` against an unlinked repository would apply migrations to a
# local container that nobody is looking at and would report success, which is
# the most expensive kind of no-op: the schema would look deployed and would not
# be.
if [ ! -f "$ROOT_DIR/supabase/.temp/project-ref" ]; then
  echo "ERROR: this repository is not linked to a Supabase project." >&2
  echo "       Link it once, then re-run 'pnpm db:push':" >&2
  echo "           supabase login" >&2
  echo "           supabase link --project-ref <your-project-ref>" >&2
  echo "       To check what would be applied, first run 'supabase db push --dry-run'." >&2
  exit 1
fi

echo "Applying pending migrations to $(cat "$ROOT_DIR/supabase/.temp/project-ref")..."

# Refuse to push onto a ledger that disagrees with the files.
#
# `db push` applies every filename absent from supabase_migrations, so a drifted
# ledger -- which is what a migration applied through the Supabase MCP leaves
# behind, because that endpoint stamps the version as the current time -- makes
# it re-apply a migration that is already in the database. It fails on the first
# object that already exists, which is survivable, but the obvious "fix" of
# deleting the ledger row discards the record of what the database contains.
#
# Checking first turns that into one clear instruction. The check is read-only
# and never repairs: repairing is a separate, explicit invocation, because a
# wrong repair is the one failure this whole mechanism exists to prevent.
#
# This exits 0 with a warning when psql is absent, so a workstation without a
# PostgreSQL client keeps working rather than being blocked on a nicety.
if [ -f "$ROOT_DIR/infra/db/verify-migration-ledger.sh" ]; then
  bash "$ROOT_DIR/infra/db/verify-migration-ledger.sh" || exit 1
fi

# Run from the repository root rather than passing --workdir. The CLI resolves
# its project directory by walking up from the working directory looking for
# supabase/config.toml, and --workdir is not one of the flags `db push` itself
# documents; relying on the walk-up keeps this working whatever version of the
# CLI is installed, while an unrecognised flag would fail the one command that
# deploys the schema.
cd "$ROOT_DIR"
supabase db push
