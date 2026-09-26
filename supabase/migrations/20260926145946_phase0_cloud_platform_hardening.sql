-- Phase 0 Cloud platform hardening.
-- Keep HIMS data behind the NestJS API: no direct Supabase Data API access
-- to the HIMS schemas or internal RLS helper functions.

BEGIN;

-- 1) Keep the internal RLS event-trigger helper, but remove all Data API-callable
-- execution paths. Event triggers invoke their function internally.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, service_role;

-- 2) Fix the search_path of every public HIMS RLS helper.
ALTER FUNCTION public.hims_current_tenant_id()
  SET search_path = pg_catalog;
ALTER FUNCTION public.hims_current_user_id()
  SET search_path = pg_catalog;
ALTER FUNCTION public.hims_current_facility_ids()
  SET search_path = pg_catalog;
ALTER FUNCTION public.hims_is_tenant_admin()
  SET search_path = pg_catalog;

-- These helpers are implementation details of the NestJS/PostgreSQL RLS path,
-- not Data API RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.hims_current_tenant_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hims_current_tenant_id() FROM anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.hims_current_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hims_current_user_id() FROM anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.hims_current_facility_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hims_current_facility_ids() FROM anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.hims_is_tenant_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hims_is_tenant_admin() FROM anon, authenticated, service_role;

-- Preserve execution for the actual backend role.
GRANT EXECUTE ON FUNCTION public.hims_current_tenant_id() TO hims_app;
GRANT EXECUTE ON FUNCTION public.hims_current_user_id() TO hims_app;
GRANT EXECUTE ON FUNCTION public.hims_current_facility_ids() TO hims_app;
GRANT EXECUTE ON FUNCTION public.hims_is_tenant_admin() TO hims_app;

-- 3) Defense in depth: HIMS schemas are backend-only schemas. The Supabase
-- Data API is not part of the HIMS data path, so anon/authenticated/service_role
-- should have neither schema USAGE nor object access there.
DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'hims_%'
  LOOP
    EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM anon, authenticated, service_role', s);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon, authenticated, service_role', s);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon, authenticated, service_role', s);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM anon, authenticated, service_role', s);

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL ON TABLES FROM anon, authenticated, service_role',
      s
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role',
      s
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role',
      s
    );
  END LOOP;
END
$$;

COMMIT;
