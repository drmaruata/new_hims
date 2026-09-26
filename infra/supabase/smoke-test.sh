#!/usr/bin/env bash
set -euo pipefail

# Reachability check for a Supabase Cloud project.
#
# Confirms the three services HIMS depends on are reachable and that the project
# actually answers, without asserting anything about the HIMS schema — that is
# what `pnpm db:verify-rls` is for. Useful immediately after creating a project,
# because a wrong project ref and a wrong key both surface as a connection
# failure and this narrows down which.

# No default. A Supabase Cloud URL is derived from the project ref and there is
# no localhost to fall back to, so a missing value has to fail rather than
# quietly checking a host that does not exist.
: "${SUPABASE_URL:?Set SUPABASE_URL to the project URL, e.g. https://<project-ref>.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

echo "Checking Supabase project: $SUPABASE_URL"

curl --fail --silent --show-error "$SUPABASE_URL/auth/v1/health" >/dev/null
echo "PASS auth"

curl --fail --silent --show-error "$SUPABASE_URL/storage/v1/status" >/dev/null
echo "PASS storage"

if [ -n "$SUPABASE_ANON_KEY" ]; then
  curl --fail --silent --show-error     -H "apikey: $SUPABASE_ANON_KEY"     -H "Authorization: Bearer $SUPABASE_ANON_KEY"     "$SUPABASE_URL/rest/v1/" >/dev/null
  echo "PASS rest"
else
  # Not a failure. An unauthenticated request to the Data API is expected to be
  # rejected, so this check only says anything useful with a key attached.
  echo "SKIP rest: SUPABASE_ANON_KEY was not provided"
fi

echo "Supabase project reachability checks completed."
