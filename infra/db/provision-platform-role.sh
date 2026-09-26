#!/usr/bin/env bash
set -euo pipefail

# Provision the *platform* database role: the one BYPASSRLS credential the two
# workers hold, and the only one.
#
# Why this role exists at all: draining hims_workflow.outbox_events and sweeping
# integration work are cross-tenant by nature. They have no user, no facility and
# no single tenant, so they cannot be expressed as tenant-scoped work under RLS —
# an unscoped read returns zero rows and looks like "no events" forever. The
# application role must not gain that privilege, or every policy in the baseline
# migration is moot, so the workers get a second, separate role instead. See
# `PlatformDatabaseService` in apps/worker and ADR-0003.
#
# The privilege is deliberately narrow: BYPASSRLS plus table-level grants on the
# two schemas the platform services actually touch, and nothing else. No
# DELETE outside the outbox retention sweep, because clinical deletion is an
# amendment, cancellation or retirement workflow rather than a row removal.
#
# This script is idempotent: re-running it re-applies the password and the
# grants, which is also how it picks up tables created after the role was first
# provisioned. On a project where migrations have not been applied there are no
# hims_* schemas to grant on, so the role is created without grants and the
# script says so; re-run it after `pnpm db:push`.
: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to an administrative connection (a superuser, or the Supabase Cloud postgres role)}"
: "${HIMS_DB_PLATFORM_PASSWORD:?Set HIMS_DB_PLATFORM_PASSWORD to a strong per-environment password}"

PLATFORM_ROLE="${HIMS_DB_PLATFORM_ROLE:-hims_platform}"

# psql interpolates :variables in ordinary SQL but NOT inside a dollar-quoted
# string, so `:'platform_role'` cannot be used within a `DO $$ ... $$` block. Every
# dynamic statement below is therefore generated with format() in a plain SELECT
# and dispatched with \gexec, which keeps the role name, password and grants out
# of the SQL text while interpolating all of them safely.
psql "$DATABASE_ADMIN_URL" \
  -v ON_ERROR_STOP=1 \
  -v platform_role="$PLATFORM_ROLE" \
  -v platform_password="$HIMS_DB_PLATFORM_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  :'platform_role',
  :'platform_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'platform_role')
\gexec

SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L',
  :'platform_role',
  :'platform_password'
)
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'platform_role')
\gexec

-- BYPASSRLS is the whole point of this role, and it is the *only* privilege
-- granted at the role level.
--
-- NOSUPERUSER is deliberately absent from this statement. On a Supabase Cloud
-- project the `postgres` role cannot set it — the platform hook answers
-- "permission denied to alter role" — and a role created by CREATE ROLE is not a
-- superuser in the first place. The verification at the end of this script is
-- what proves it, and it is the check worth trusting rather than the request
-- that cannot be issued. NOSUPERUSER belongs in a plain-PostgreSQL deployment,
-- run with an administrative role that can actually set it.
ALTER ROLE :"platform_role" NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;

REVOKE ALL ON SCHEMA public FROM :"platform_role";

-- Schema USAGE. Guarded on the schema existing: granting on a schema that is not
-- there yet aborts the script under ON_ERROR_STOP, which would leave the role
-- created but unprivileged and send the operator looking for a different fault.
SELECT format('GRANT USAGE ON SCHEMA %I TO %I;', s, :'platform_role')
FROM unnest(ARRAY['hims_workflow', 'hims_integration']) AS s
WHERE to_regnamespace(s) IS NOT NULL
\gexec

-- Table grants, one row per platform operation, so the privilege on each table
-- is reviewable next to the statement that needs it rather than swept across a
-- whole schema:
--
--   outbox_events     claim, requeue, mark published, record failure, prune
--   integrations      find the ACTIVE integrations for a tenant
--   messages          create an outbound record, update status and sent_at
--   message_attempts  append one row per delivery attempt
--   dead_letters      record and clear a replayable failure
--
-- `adminQuery()` on the worker's platform service is an escape hatch that can
-- reach anything the grants allow, which is why they are per-table and exclude
-- DELETE outside the outbox.
SELECT format('GRANT %s ON %I.%I TO %I;', t.privs, n.nspname, c.relname, :'platform_role')
FROM (
  VALUES
    ('hims_workflow',    'outbox_events',     'SELECT, UPDATE, DELETE'),
    ('hims_integration', 'integrations',      'SELECT'),
    ('hims_integration', 'messages',          'SELECT, INSERT, UPDATE'),
    ('hims_integration', 'message_attempts',  'SELECT, INSERT'),
    ('hims_integration', 'dead_letters',      'SELECT, INSERT, UPDATE')
) AS t(schema_name, table_name, privs)
JOIN pg_namespace n ON n.nspname = t.schema_name
JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = t.table_name
 AND c.relkind = 'r'
\gexec

-- Sequence USAGE for the inserts above, in case any of those tables uses a
-- serial or identity column rather than a generated uuid.
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I;', s, :'platform_role')
FROM unnest(ARRAY['hims_workflow', 'hims_integration']) AS s
WHERE to_regnamespace(s) IS NOT NULL
\gexec

-- Default privileges as well, so a table added to either schema by a later
-- migration is covered the next time this script runs. Scoped to the connecting
-- role, which is the one that applies migrations.
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO %I;', s, :'platform_role')
FROM unnest(ARRAY['hims_workflow', 'hims_integration']) AS s
WHERE to_regnamespace(s) IS NOT NULL
\gexec

-- Anything skipped above, said out loud rather than left to be discovered as a
-- permission error inside a worker at 3am.
SELECT 'no grants applied: schema ' || s || ' does not exist yet — apply migrations then re-run'
  AS warning
FROM unnest(ARRAY['hims_workflow', 'hims_integration']) AS s
WHERE to_regnamespace(s) IS NULL;

SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
  FROM pg_roles
 WHERE rolname = :'platform_role';

-- Fail rather than advise. A superuser platform role is a privilege the design
-- never intended, and a role without BYPASSRLS is worse: the outbox drain would
-- read zero rows and report "published 0 events" forever, which looks like a
-- healthy system dropping every domain event.
SELECT rolsuper AS platform_is_super, rolbypassrls AS platform_has_bypassrls
  FROM pg_roles
 WHERE rolname = :'platform_role'
\gset

\if :platform_is_super
\echo 'ERROR: the platform role is a superuser. Revoke it before pointing DATABASE_PLATFORM_URL at it.'
\quit 1
\endif

\if :platform_has_bypassrls
\else
\echo 'ERROR: the platform role has no BYPASSRLS. The cross-tenant drain would silently read zero rows.'
\quit 1
\endif
SQL

echo "Provisioned ${PLATFORM_ROLE} with BYPASSRLS; verify the row above shows rolsuper = f and rolbypassrls = t."
echo "Point DATABASE_PLATFORM_URL at this role — never at DATABASE_URL, and never at DATABASE_ADMIN_URL."
