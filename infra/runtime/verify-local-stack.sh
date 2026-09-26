#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${DATABASE_URL:?Set DATABASE_URL to the hims_app connection}"
: "${DATABASE_PLATFORM_URL:?Set DATABASE_PLATFORM_URL to the hims_platform connection}"

fail=0
pass() { printf 'PASS  %s\n' "$1"; }
failcheck() { printf 'FAIL  %s\n' "$1" >&2; fail=1; }

command -v docker >/dev/null 2>&1 || { echo "ERROR: docker CLI is required." >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required." >&2; exit 2; }

# Cloud Supabase reachability.
if curl --fail --silent --show-error "${SUPABASE_URL%/}/auth/v1/health" >/dev/null; then pass "Supabase Auth"; else failcheck "Supabase Auth"; fi
if curl --fail --silent --show-error "${SUPABASE_URL%/}/storage/v1/status" >/dev/null; then pass "Supabase Storage"; else failcheck "Supabase Storage"; fi

# Container state.
for c in hims-api hims-worker hims-integration-worker hims-redis hims-orthanc hims-gotenberg hims-clamav hims-opensearch hims-mailpit; do
  status="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || true)"
  if [ "$status" = "running" ]; then pass "$c running"; else failcheck "$c running (status=$status)"; fi
done

# Host-facing supporting service endpoints.
if curl --fail --silent --show-error http://localhost:4000/api/v1/health >/dev/null; then pass "HIMS API"; else failcheck "HIMS API"; fi
if curl --fail --silent --show-error http://localhost:8042/system >/dev/null; then pass "Orthanc"; else failcheck "Orthanc"; fi
if curl --fail --silent --show-error http://localhost:3001/health >/dev/null; then pass "Gotenberg"; else failcheck "Gotenberg"; fi
if curl --fail --silent --show-error http://localhost:9200/_cluster/health >/dev/null; then pass "OpenSearch"; else failcheck "OpenSearch"; fi
if curl --fail --silent --show-error http://localhost:8025/ >/dev/null; then pass "Mailpit"; else failcheck "Mailpit"; fi
if (echo >/dev/tcp/localhost/3310) >/dev/null 2>&1; then pass "ClamAV"; else failcheck "ClamAV"; fi
if (echo >/dev/tcp/localhost/6379) >/dev/null 2>&1; then pass "Redis port"; else failcheck "Redis port"; fi

# Verify the containers can reach the Cloud database as their intended roles.
db_probe='const {Client}=require("pg"); const c=new Client({connectionString:process.env.PROBE_URL,ssl:{rejectUnauthorized:false}}); c.connect().then(()=>c.query("select current_user, current_database()")).then(r=>{console.log(JSON.stringify(r.rows[0])); return c.end()}).catch(async e=>{console.error(e.message); try{await c.end()}catch{}; process.exit(1)})'
if docker exec -e PROBE_URL="$DATABASE_URL" hims-api node -e "$db_probe" >/dev/null; then pass "hims-api -> Cloud PostgreSQL (hims_app)"; else failcheck "hims-api -> Cloud PostgreSQL"; fi
if docker exec -e PROBE_URL="$DATABASE_PLATFORM_URL" hims-worker node -e "$db_probe" >/dev/null; then pass "hims-worker -> Cloud PostgreSQL (hims_platform)"; else failcheck "hims-worker -> Cloud PostgreSQL"; fi
if docker exec -e PROBE_URL="$DATABASE_PLATFORM_URL" hims-integration-worker node -e "$db_probe" >/dev/null; then pass "integration-worker -> Cloud PostgreSQL (hims_platform)"; else failcheck "integration-worker -> Cloud PostgreSQL"; fi

# Role invariants as observed by PostgreSQL.
role_probe='const {Client}=require("pg"); const c=new Client({connectionString:process.env.PROBE_URL,ssl:{rejectUnauthorized:false}}); c.connect().then(()=>c.query("select current_user")).then(r=>{console.log(r.rows[0].current_user); return c.end()}).catch(async e=>{console.error(e.message); try{await c.end()}catch{}; process.exit(1)})'
if docker exec -e PROBE_URL="$DATABASE_URL" hims-api node -e "$role_probe" | grep -qx 'hims_app'; then pass "API database role = hims_app"; else failcheck "API database role = hims_app"; fi

if [ "$fail" -ne 0 ]; then
  echo
  echo "Runtime bring-up FAILED. Fix the checks above and rerun."
  exit 1
fi

echo
echo "Runtime bring-up checks passed."
