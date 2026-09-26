#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?Set SUPABASE_URL to the Supabase project URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY in the local environment; never commit it}"
: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the Supabase administrative connection}"
: "${BOOTSTRAP_ADMIN_EMAIL:?Set BOOTSTRAP_ADMIN_EMAIL to the first HIMS administrator email}"
: "${BOOTSTRAP_ADMIN_PASSWORD:?Set BOOTSTRAP_ADMIN_PASSWORD to the first HIMS administrator password}"
BOOTSTRAP_ADMIN_NAME="${BOOTSTRAP_ADMIN_NAME:-HIMS Administrator}"

TENANT_ID="${HIMS_BOOTSTRAP_TENANT_ID:-11111111-1111-4111-8111-111111111111}"
FACILITY_ID="${HIMS_BOOTSTRAP_FACILITY_ID:-22222222-2222-4222-8222-222222222221}"
ADMIN_ROLE_CODE="ADMIN"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Create the Auth user through the supported Supabase Auth admin endpoint.
# This avoids direct writes to auth.users, which is an internal Auth schema.
payload="$(printf '%s' "$(node -e 'process.stdout.write(JSON.stringify({email:process.env.BOOTSTRAP_ADMIN_EMAIL,password:process.env.BOOTSTRAP_ADMIN_PASSWORD,email_confirm:true,user_metadata:{full_name:process.env.BOOTSTRAP_ADMIN_NAME}}))')")"

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

http_code="$(curl --silent --show-error --output "$response_file" --write-out '%{http_code}' \
  -X POST "${SUPABASE_URL%/}/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  --data "$payload")"

if [ "$http_code" -ge 300 ]; then
  echo "ERROR: Supabase Auth admin user creation failed (HTTP $http_code)." >&2
  cat "$response_file" >&2
  exit 1
fi

USER_ID="$(node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!x.id) process.exit(2); process.stdout.write(x.id)' "$response_file")"

echo "Created/located HIMS administrator Auth user: $USER_ID"

# Link the Auth identity to the HIMS authorization model.
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -v user_id="$USER_ID" \
  -v tenant_id="$TENANT_ID" \
  -v facility_id="$FACILITY_ID" \
  -v email="$BOOTSTRAP_ADMIN_EMAIL" \
  -v display_name="$BOOTSTRAP_ADMIN_NAME" <<'SQL'
BEGIN;

INSERT INTO hims_core.tenant_memberships
  (tenant_id, user_id, membership_status, is_tenant_admin)
VALUES
  (:'tenant_id', :'user_id', 'ACTIVE', true)
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.user_profiles
  (user_id, tenant_id, display_name, email, professional_category, status)
VALUES
  (:'user_id', :'tenant_id', :'display_name', :'email', 'ADMINISTRATOR', 'ACTIVE')
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    status = EXCLUDED.status;

INSERT INTO hims_core.user_facility_access
  (tenant_id, user_id, facility_id)
VALUES
  (:'tenant_id', :'user_id', :'facility_id')
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.user_department_access
  (tenant_id, user_id, department_id)
SELECT
  :'tenant_id'::uuid,
  :'user_id'::uuid,
  d.id
FROM hims_core.departments d
WHERE d.tenant_id = :'tenant_id'::uuid
  AND d.facility_id = :'facility_id'::uuid
  AND d.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

INSERT INTO hims_core.user_roles
  (user_id, tenant_id, role_id, facility_id, status)
SELECT
  :'user_id'::uuid,
  :'tenant_id'::uuid,
  r.id,
  :'facility_id'::uuid,
  'ACTIVE'
FROM hims_core.roles r
WHERE r.tenant_id = :'tenant_id'::uuid
  AND r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

COMMIT;
SQL

echo "HIMS administrator authorization bootstrap completed for tenant $TENANT_ID."
