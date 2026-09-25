#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

echo "Checking Supabase gateway: $SUPABASE_URL"

curl --fail --silent --show-error "$SUPABASE_URL/auth/v1/health" >/dev/null
echo "PASS auth"

curl --fail --silent --show-error "$SUPABASE_URL/storage/v1/status" >/dev/null
echo "PASS storage"

if [[ -n "$SUPABASE_ANON_KEY" ]]; then
  curl --fail --silent --show-error     -H "apikey: $SUPABASE_ANON_KEY"     -H "Authorization: Bearer $SUPABASE_ANON_KEY"     "$SUPABASE_URL/rest/v1/" >/dev/null
  echo "PASS rest"
else
  echo "SKIP rest: SUPABASE_ANON_KEY was not provided"
fi

echo "Supabase platform smoke checks completed."
