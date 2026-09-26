# Database bootstrap and isolation

The HIMS API must never connect as the PostgreSQL postgres superuser. The baseline schema enables tenant RLS, but a superuser or a role with BYPASSRLS bypasses that protection.

Bootstrap sequence:

1. Start the pinned self-hosted Supabase stack from infra/supabase.
2. Apply the numbered HIMS migrations using the migration runner.
3. Apply seed data only in development/test environments.
4. Run provision-app-role.sh using a separate administrator/migration connection.
5. Set the API DATABASE_URL to the resulting hims_app connection.
6. Run verify-rls.sh before allowing application traffic.

The application role receives SELECT/INSERT/UPDATE but no DELETE. Clinical deletion is represented by amendments, cancellation or retirement workflows.

Production database provisioning must use a secret manager. Do not commit database passwords or service-role credentials.
