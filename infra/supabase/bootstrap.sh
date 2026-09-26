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
echo "Start without demo seed:"
echo "  docker compose -f infra/supabase/runtime/docker-compose.yml -f infra/supabase/docker-compose.hims.yml up -d --wait"
echo
echo "Development-only seed:"
echo "  docker compose -f infra/supabase/runtime/docker-compose.yml -f infra/supabase/docker-compose.hims.yml -f infra/supabase/docker-compose.hims-seed.yml up -d --wait"
