#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the non-BYPASSRLS HIMS application connection}"
: "${HIMS_TENANT_ID:?Set HIMS_TENANT_ID to a tenant that should be visible}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v tenant="$HIMS_TENANT_ID" <<'SQL'
DO $$
DECLARE
  visible_count bigint;
  hidden_count bigint;
  target_tenant uuid := :'tenant'::uuid;
BEGIN
  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'RLS test must run as a non-superuser, non-BYPASSRLS role; current role is %', current_user;
  END IF;

  PERFORM set_config('app.tenant_id', target_tenant::text, true);
  SELECT count(*) INTO visible_count FROM hims_core.facilities WHERE tenant_id = target_tenant;

  PERFORM set_config('app.tenant_id', '00000000-0000-0000-0000-000000000000', true);
  SELECT count(*) INTO hidden_count FROM hims_core.facilities;

  IF visible_count = 0 THEN
    RAISE EXCEPTION 'Expected tenant % to have visible seed/configuration data', target_tenant;
  END IF;

  IF hidden_count <> 0 THEN
    RAISE EXCEPTION 'Cross-tenant read leaked % rows', hidden_count;
  END IF;

  RAISE NOTICE 'RLS verification passed: visible=% hidden=%', visible_count, hidden_count;
END
$$;
SQL
