-- Phase 0 facility-scope RLS hardening.
-- Tenant isolation is necessary but not sufficient: a non-admin user with
-- access to one facility must not read/write another facility in the same
-- tenant. Tenant administrators receive an explicit RLS context flag.

BEGIN;

CREATE OR REPLACE FUNCTION hims_current_facility_ids()
RETURNS uuid[]
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT value::uuid
      FROM jsonb_array_elements_text(
        COALESCE(NULLIF(current_setting('app.facility_ids', true), ''), '[]')::jsonb
      ) AS value
    ),
    ARRAY[]::uuid[]
  );
$$;

CREATE OR REPLACE FUNCTION hims_is_tenant_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_tenant_admin', true), ''), 'false')::boolean;
$$;

DO $$
DECLARE
  rec record;
  predicate text;
BEGIN
  FOR rec IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema LIKE 'hims_%'
      AND c.column_name = 'tenant_id'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns f
        WHERE f.table_schema = c.table_schema
          AND f.table_name = c.table_name
          AND f.column_name = 'facility_id'
      )
      AND NOT (
        c.table_schema = 'hims_core'
        AND c.table_name = 'user_facility_access'
      )
  LOOP
    predicate := format(
      '(facility_id IS NULL OR hims_is_tenant_admin() OR facility_id = ANY(hims_current_facility_ids()))'
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.table_name || '_tenant_select', rec.table_schema, rec.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.table_name || '_tenant_insert', rec.table_schema, rec.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.table_name || '_tenant_update', rec.table_schema, rec.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR SELECT TO public USING (tenant_id = hims_current_tenant_id() AND %s)',
      rec.table_name || '_tenant_select', rec.table_schema, rec.table_name, predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR INSERT TO public WITH CHECK (tenant_id = hims_current_tenant_id() AND %s)',
      rec.table_name || '_tenant_insert', rec.table_schema, rec.table_name, predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR UPDATE TO public USING (tenant_id = hims_current_tenant_id() AND %s) WITH CHECK (tenant_id = hims_current_tenant_id() AND %s)',
      rec.table_name || '_tenant_update', rec.table_schema, rec.table_name, predicate, predicate
    );
  END LOOP;
END
$$;

-- Access-control tables are special: users must be able to resolve their own
-- grants during authentication, but ordinary users must never enumerate or
-- mutate another user's grants.

DROP POLICY IF EXISTS user_facility_access_tenant_select ON hims_core.user_facility_access;
DROP POLICY IF EXISTS user_facility_access_tenant_insert ON hims_core.user_facility_access;
DROP POLICY IF EXISTS user_facility_access_tenant_update ON hims_core.user_facility_access;

CREATE POLICY user_facility_access_self_select
  ON hims_core.user_facility_access
  FOR SELECT TO public
  USING (
    tenant_id = hims_current_tenant_id()
    AND (user_id = hims_current_user_id() OR hims_is_tenant_admin())
  );

CREATE POLICY user_facility_access_admin_insert
  ON hims_core.user_facility_access
  FOR INSERT TO public
  WITH CHECK (
    tenant_id = hims_current_tenant_id()
    AND hims_is_tenant_admin()
  );

CREATE POLICY user_facility_access_admin_update
  ON hims_core.user_facility_access
  FOR UPDATE TO public
  USING (
    tenant_id = hims_current_tenant_id()
    AND hims_is_tenant_admin()
  )
  WITH CHECK (
    tenant_id = hims_current_tenant_id()
    AND hims_is_tenant_admin()
  );

DROP POLICY IF EXISTS user_department_access_tenant_select ON hims_core.user_department_access;
DROP POLICY IF EXISTS user_department_access_tenant_insert ON hims_core.user_department_access;
DROP POLICY IF EXISTS user_department_access_tenant_update ON hims_core.user_department_access;

CREATE POLICY user_department_access_self_select
  ON hims_core.user_department_access
  FOR SELECT TO public
  USING (
    tenant_id = hims_current_tenant_id()
    AND (user_id = hims_current_user_id() OR hims_is_tenant_admin())
  );

CREATE POLICY user_department_access_admin_insert
  ON hims_core.user_department_access
  FOR INSERT TO public
  WITH CHECK (
    tenant_id = hims_current_tenant_id()
    AND hims_is_tenant_admin()
  );

CREATE POLICY user_department_access_admin_update
  ON hims_core.user_department_access
  FOR UPDATE TO public
  USING (
    tenant_id = hims_current_tenant_id()
    AND hims_is_tenant_admin()
  )
  WITH CHECK (
    tenant_id = hims_current_tenant_id()
    AND hims_is_tenant_admin()
  );

COMMIT;
