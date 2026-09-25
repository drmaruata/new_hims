#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to a superuser/migration connection string}"
: "${HIMS_DB_APP_PASSWORD:?Set HIMS_DB_APP_PASSWORD to a strong per-environment password}"

APP_ROLE="${HIMS_DB_APP_ROLE:-hims_app}"

psql "$DATABASE_ADMIN_URL" \
  -v ON_ERROR_STOP=1 \
  -v app_role="$APP_ROLE" \
  -v app_password="$HIMS_DB_APP_PASSWORD" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_role', :'app_password');
  ELSE
    EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_role', :'app_password');
  END IF;
END
$$;

ALTER ROLE :"app_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON SCHEMA public FROM :"app_role";

DO $$
DECLARE
  schema_name text;
BEGIN
  FOR schema_name IN
    SELECT unnest(ARRAY[
      'hims_core','hims_patient','hims_catalog','hims_clinical',
      'hims_opd','hims_ipd','hims_lab','hims_rad','hims_emergency',
      'hims_ot','hims_icu','hims_pharmacy','hims_inventory','hims_billing',
      'hims_insurance','hims_emr','hims_documents','hims_quality',
      'hims_workflow','hims_integration','hims_audit','hims_ai'
    ])
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', schema_name, :'app_role');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO %I', schema_name, :'app_role');
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', schema_name, :'app_role');
  END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION hims_current_tenant_id() TO :"app_role";
GRANT EXECUTE ON FUNCTION hims_current_user_id() TO :"app_role";

DO $$
DECLARE
  schema_name text;
BEGIN
  FOR schema_name IN
    SELECT unnest(ARRAY[
      'hims_core','hims_patient','hims_catalog','hims_clinical',
      'hims_opd','hims_ipd','hims_lab','hims_rad','hims_emergency',
      'hims_ot','hims_icu','hims_pharmacy','hims_inventory','hims_billing',
      'hims_insurance','hims_emr','hims_documents','hims_quality',
      'hims_workflow','hims_integration','hims_audit','hims_ai'
    ])
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO %I',
      schema_name, :'app_role'
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I',
      schema_name, :'app_role'
    );
  END LOOP;
END
$$;
SQL

echo "Provisioned ${APP_ROLE}; verify the role is non-superuser and NOBYPASSRLS."
