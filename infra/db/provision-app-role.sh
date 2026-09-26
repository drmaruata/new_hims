#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to a superuser/migration connection string}"
: "${HIMS_DB_APP_PASSWORD:?Set HIMS_DB_APP_PASSWORD to a strong per-environment password}"

APP_ROLE="${HIMS_DB_APP_ROLE:-hims_app}"

# psql interpolates :variables in ordinary SQL but NOT inside a dollar-quoted
# string, so `:'app_role'` cannot be used within a `DO $$ ... $$` block: psql
# sends the text through verbatim and PL/pgSQL then fails to parse the colon.
# Every dynamic statement below is therefore generated with format() in a plain
# SELECT and dispatched with \gexec. That keeps the role name and password out of
# the SQL text while interpolating both safely.
#
# The schema list is published once as a session GUC so it is defined in exactly
# one place instead of being repeated per grant.
psql "$DATABASE_ADMIN_URL" \
  -v ON_ERROR_STOP=1 \
  -v app_role="$APP_ROLE" \
  -v app_password="$HIMS_DB_APP_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  :'app_role',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L',
  :'app_role',
  :'app_password'
)
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

SELECT set_config(
  'hims.schemas',
  'hims_core,hims_patient,hims_catalog,hims_clinical,hims_opd,hims_ipd,hims_lab,hims_rad,hims_emergency,hims_ot,hims_icu,hims_pharmacy,hims_inventory,hims_billing,hims_insurance,hims_emr,hims_documents,hims_quality,hims_workflow,hims_integration,hims_audit,hims_ai',
  false
);

-- The application role must never be able to bypass tenant isolation.
ALTER ROLE :"app_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON SCHEMA public FROM :"app_role";

SELECT format(
  'GRANT USAGE ON SCHEMA %I TO %I; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO %I; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I;',
  s, :'app_role', s, :'app_role', s, :'app_role'
)
FROM unnest(string_to_array(current_setting('hims.schemas'), ',')) AS s
\gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO %I; ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I;',
  s, :'app_role', s, :'app_role'
)
FROM unnest(string_to_array(current_setting('hims.schemas'), ',')) AS s
\gexec

-- Every RLS policy evaluates these four helpers, so the application role needs
-- EXECUTE on all of them. PostgreSQL grants EXECUTE on new functions to PUBLIC
-- by default, which is why the facility helpers worked without being listed
-- here; granting them explicitly keeps the role working if that default is ever
-- tightened. The first two come from the baseline migration, the facility pair
-- from the phase 0 facility-scope RLS hardening migration.
GRANT EXECUTE ON FUNCTION public.hims_current_tenant_id() TO :"app_role";
GRANT EXECUTE ON FUNCTION public.hims_current_user_id() TO :"app_role";
GRANT EXECUTE ON FUNCTION public.hims_current_facility_ids() TO :"app_role";
GRANT EXECUTE ON FUNCTION public.hims_is_tenant_admin() TO :"app_role";
SQL

echo "Provisioned ${APP_ROLE}; verify the role is non-superuser and NOBYPASSRLS."
