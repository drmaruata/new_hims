#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the non-BYPASSRLS HIMS application connection}"
: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the migration/admin connection}"
: "${HIMS_TENANT_ID:?Set HIMS_TENANT_ID to a tenant that should be visible}"

psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  tenant_tables bigint;
  secured_tables bigint;
BEGIN
  SELECT count(*) INTO tenant_tables
  FROM information_schema.columns c
  WHERE c.table_schema LIKE 'hims_%'
    AND c.column_name = 'tenant_id'
    AND EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = c.table_schema
        AND t.table_name = c.table_name
    );

  SELECT count(*) INTO secured_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname LIKE 'hims_%'
    AND c.relkind = 'r'
    AND c.relrowsecurity;

  IF tenant_tables <> secured_tables THEN
    RAISE EXCEPTION 'RLS coverage mismatch: tenant-owned tables=% RLS-enabled tables=%', tenant_tables, secured_tables;
  END IF;

  RAISE NOTICE 'RLS structural coverage passed: % tenant-owned tables secured', tenant_tables;
END
$$;
SQL

psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO hims_core.departments
  (id, tenant_id, facility_id, department_code, name, department_type, clinical_service_flag)
VALUES
  ('33333333-3333-3333-3333-333333333399',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'RLS_TEST',
   'RLS Test Department',
   'ADMIN',
   false)
ON CONFLICT (facility_id, department_code) DO NOTHING;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v tenant="$HIMS_TENANT_ID" <<'SQL'
DO $$
DECLARE
  visible_count bigint;
  hidden_count bigint;
  facility_visible_count bigint;
  tenant_admin_count bigint;
  target_tenant uuid := :'tenant'::uuid;
BEGIN
  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'RLS test must run as a non-superuser, non-BYPASSRLS role; current role is %', current_user;
  END IF;

  PERFORM set_config('app.tenant_id', target_tenant::text, true);
  PERFORM set_config('app.is_tenant_admin', 'false', true);
  PERFORM set_config('app.facility_ids', '["22222222-2222-2222-2222-222222222221"]', true);

  SELECT count(*) INTO visible_count
  FROM hims_core.facilities
  WHERE tenant_id = target_tenant;

  PERFORM set_config('app.tenant_id', '00000000-0000-0000-0000-000000000000', true);
  SELECT count(*) INTO hidden_count FROM hims_core.facilities;

  IF visible_count = 0 THEN
    RAISE EXCEPTION 'Expected tenant % to have visible seed/configuration data', target_tenant;
  END IF;

  IF hidden_count <> 0 THEN
    RAISE EXCEPTION 'Cross-tenant read leaked % rows', hidden_count;
  END IF;

  PERFORM set_config('app.tenant_id', target_tenant::text, true);
  PERFORM set_config('app.facility_ids', '["22222222-2222-2222-2222-222222222221"]', true);
  PERFORM set_config('app.is_tenant_admin', 'false', true);

  SELECT count(*) INTO facility_visible_count
  FROM hims_core.departments
  WHERE tenant_id = target_tenant;

  IF facility_visible_count <> 10 THEN
    RAISE EXCEPTION 'Facility RLS expected exactly the seeded main-campus departments, got %', facility_visible_count;
  END IF;

  PERFORM set_config('app.is_tenant_admin', 'true', true);
  PERFORM set_config('app.facility_ids', '[]', true);

  SELECT count(*) INTO tenant_admin_count
  FROM hims_core.departments
  WHERE tenant_id = target_tenant;

  IF tenant_admin_count < 11 THEN
    RAISE EXCEPTION 'Tenant-admin RLS should see both facility scopes, got %', tenant_admin_count;
  END IF;

  RAISE NOTICE 'RLS behavioral verification passed: tenant visible=% hidden=%; facility visible=%; tenant-admin visible=%',
    visible_count, hidden_count, facility_visible_count, tenant_admin_count;
END
$$;
SQL
