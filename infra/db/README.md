# Database bootstrap and isolation

The HIMS API must never connect as the PostgreSQL postgres superuser. The baseline schema enables tenant RLS, but a superuser or a role with BYPASSRLS bypasses that protection.

Bootstrap sequence:

1. Start the pinned self-hosted Supabase stack from infra/supabase.
2. Apply the numbered HIMS migrations using the migration runner (`pnpm db:migrate`).
3. Apply seed data only in development/test environments (`pnpm db:seed`).
4. Provision the application role (`pnpm db:provision-app-role`).
5. Set the API DATABASE_URL to the resulting hims_app connection.
6. Run `HIMS_TENANT_ID=<uuid> pnpm db:verify-rls` before allowing application traffic.

The migration runner replays the whole chain in filename order and is not
incremental, so it must be run exactly once against a given database. It refuses
to start if the HIMS schema is already present rather than failing part way
through. To rebuild a development database from scratch use `pnpm db:reset`,
which requires HIMS_DB_RESET_CONFIRM=1.

The application role receives SELECT/INSERT/UPDATE but no DELETE. Clinical deletion is represented by amendments, cancellation or retirement workflows.

Production database provisioning must use a secret manager. Do not commit database passwords or service-role credentials.
