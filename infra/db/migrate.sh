#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration connection}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

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
