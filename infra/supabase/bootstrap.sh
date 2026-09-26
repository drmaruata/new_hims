#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/infra/supabase/runtime"
REF="${SUPABASE_SELF_HOSTED_REF:-self-hosted/v0.8.2}"

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 1; }

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Fetching official Supabase Docker configuration at $REF..."
git clone --depth 1 --branch "$REF" https://github.com/supabase/supabase.git "$tmp_dir/supabase"

rm -rf "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR"
cp -a "$tmp_dir/supabase/docker/." "$RUNTIME_DIR/"

printf 'ref=%s\n' "$REF" > "$RUNTIME_DIR/.supabase-version"

if [[ ! -f "$RUNTIME_DIR/.env" ]]; then
  cp "$RUNTIME_DIR/.env.example" "$RUNTIME_DIR/.env"
fi

echo
echo "Supabase runtime prepared at $RUNTIME_DIR"
echo "Edit $RUNTIME_DIR/.env and set strong secrets before starting."
echo
echo "Start the stack and wait for it to become healthy:"
echo "  docker compose -f infra/supabase/runtime/docker-compose.yml up -d --wait"
echo
echo "Then apply the HIMS schema through the migration runner. The migrations are"
echo "deliberately NOT mounted as Postgres init scripts: the baseline is not"
echo "replayable over an existing schema, so applying it at container init and"
echo "then again through the runner would fail, and skipping the runner would"
echo "silently leave the later migrations unapplied."
echo "  pnpm db:migrate"
echo
echo "Development-only seed (creates a demo tenant; refuses a non-local host):"
echo "  pnpm db:seed"
echo
echo "Provision the non-BYPASSRLS application role, then verify isolation:"
echo "  pnpm db:provision-app-role"
echo "  HIMS_TENANT_ID=<seed tenant uuid> pnpm db:verify-rls"
