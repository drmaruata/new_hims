# Database bootstrap and isolation

The HIMS API must never connect as the PostgreSQL `postgres` role. The baseline
schema enables tenant RLS, but on a Supabase Cloud project the `postgres` role
holds `BYPASSRLS`, so connecting as it bypasses that protection entirely. This is
the reason the dedicated application role exists — see
[ADR-0003](../../doc/ADR/0003-database-role-and-rls.md).

## Which runner, and why there are two

The platform is a managed Supabase Cloud project, and it keeps its own record of
which migrations have been applied. Which runner to use follows from whether you
are talking to that project:

| Target                                      | Command           | Tracks applied versions?                      |
| ------------------------------------------- | ----------------- | --------------------------------------------- |
| Supabase Cloud project (the platform)       | `pnpm db:push`    | Yes — `supabase_migrations.schema_migrations` |
| Plain PostgreSQL (the CI job, a scratch db) | `pnpm db:migrate` | No — replays the whole chain, once            |

Both read the same files from `supabase/migrations/`. Keeping them separate is
not redundancy, it is a correctness requirement: `migrate.sh` applies SQL without
recording anything in the platform's history, so running it against a cloud
project would leave the schema and the history table disagreeing, and the next
`supabase db push` would skip files it believed were already applied while
reporting success. Both scripts therefore refuse the target that belongs to the
other, rather than trusting the operator to pick the right one.

## Bootstrap sequence — Supabase Cloud

1. Create the project and link the repository: `supabase link --project-ref <ref>`.
2. Apply pending migrations: `pnpm db:push`.
3. Provision the application role: `pnpm db:provision-app-role`.
4. Point `DATABASE_URL` at the resulting `hims_app` connection.
5. Apply seed data **only** in development: `HIMS_ALLOW_REMOTE_SEED=1 pnpm db:seed`.
6. Run `HIMS_TENANT_ID=<uuid> pnpm db:verify-rls` before allowing application
   traffic.

`migrate.sh` refuses a cloud target, and `reset-db.sh` refuses one for the same
ledger reason. On cloud, use `supabase db reset --linked` to rebuild.

## Bootstrap sequence — plain PostgreSQL

Used by `.github/workflows/ci.yml`, which runs a `postgres:` service and never
touches Supabase.

1. Provide an `auth` schema with a `users` table. The baseline declares foreign
   keys into `auth.users(id)`; on cloud that table already exists because
   Supabase's Auth bootstrap creates it, but a bare PostgreSQL server has no such
   thing. CI creates the shim — see the workflow for the exact SQL.
2. Apply the chain: `pnpm db:migrate`.
3. Seed: `pnpm db:seed`.
4. Provision the role: `pnpm db:provision-app-role`.
5. Verify: `HIMS_TENANT_ID=<uuid> pnpm db:verify-rls`.

`migrate.sh` replays every file in filename order and is not incremental, so it
runs exactly once per database. It refuses to start if the HIMS schema is already
present rather than failing part way through the baseline. To rebuild a plain
development database, `pnpm db:reset` requires `HIMS_DB_RESET_CONFIRM=1`.

## Connecting from a cloud project

- The pooler requires the project ref in the username: `hims_app.<ref>`, not
  `hims_app`. This is the most common reason a correct password is rejected.
- Prefer the pooler. A direct connection to `db.<ref>.supabase.com` is IPv6-only
  unless the project has the paid IPv4 add-on, and pooler connections are IPv4.
- TLS is required. `loadEnv` refuses to start when `SUPABASE_URL` is a cloud host
  and `DATABASE_SSL` is off.

## Privileges and isolation

The application role receives `SELECT`/`INSERT`/`UPDATE` but no `DELETE`. Clinical
deletion is represented by amendments, cancellation or retirement workflows, so
revoking `DELETE` is a backstop rather than the mechanism.

`verify-rls.sh` is deliberately coupled to the seed: it asserts a specific tenant,
facility and department from `supabase/seed/seed.sql`, and a set of departments
that must be visible while another tenant's must not. Changing the seed breaks it,
which is the intent — it should fail loudly if the fixture it reasons about moved.

## Credentials

Production database provisioning must use a secret manager. Do not commit
database passwords, service-role credentials or seed keys. `.env.example` is a
blueprint of placeholders, not a source of values.
