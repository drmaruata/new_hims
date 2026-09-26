# Supabase Cloud baseline

The HIMS platform layer is a **managed Supabase Cloud project**. PostgreSQL,
Auth, Realtime and Storage are operated by Supabase; this repository does not
run a Supabase stack in Docker, and nothing under this directory starts one.

The root `docker-compose.yml` still runs the supporting services the API calls —
Redis, Orthanc, Gotenberg, Mailpit, ClamAV, OpenSearch — because those are not
platform services and are cheaper to run on a workstation.

## What moved, and what did not

| Concern                             | Before                                 | Now                                     |
| ----------------------------------- | -------------------------------------- | --------------------------------------- |
| PostgreSQL, Auth, Storage, Realtime | Self-hosted Docker stack               | Supabase Cloud project                  |
| Applied-migration bookkeeping       | None; `migrate.sh` replayed everything | `supabase_migrations.schema_migrations` |
| Migrations applied by               | `pnpm db:migrate`                      | `pnpm db:push` (`supabase db push`)     |
| Plain-PostgreSQL target (CI)        | `pnpm db:migrate`                      | `pnpm db:migrate` — unchanged           |
| Reset a development database        | `pnpm db:reset`                        | `supabase db reset --linked`            |
| Auth/Storage reachability check     | `bash infra/supabase/smoke-test.sh`    | unchanged                               |

Migrations stay in `supabase/migrations/` as plain SQL with the same
`YYYYMMDDHHMMSS_name.sql` naming, so the same files serve both paths. The CI job
in `.github/workflows/ci.yml` runs against a plain `postgres:` service and
deliberately does not talk to Supabase at all; it keeps using
`infra/db/migrate.sh`, which is why that script still exists.

## One-time setup

1. Create the project at <https://supabase.com/dashboard>. Note the project
   **ref** (20 lowercase alphanumeric characters) and its **region**.

2. Install the Supabase CLI. This is the one new tool the cloud path requires:

   ```sh
   npm install -g supabase
   ```

3. Link the repository to the project. `link` writes the real project ref into
   `supabase/config.toml`, replacing the placeholder:

   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

4. Copy `.env.example` to `.env` and fill it in from Project Settings → API and
   Project Settings → Database. See that file for how each value is derived and
   which of them are secrets.

## Applying the schema

There are two supported ways to apply a migration, and they are guarded against
each other. Use whichever is available; both end up in the same ledger.

```sh
pnpm db:push                             # via the Supabase CLI (needs a login token)
bash infra/db/verify-migration-ledger.sh  # is the ledger in step with the files?
```

`db push` applies only files absent from the platform's migration history, so it
is safe to re-run and will say "no pending migrations" when there is nothing to
do. Each file is applied in one transaction and its version is recorded only on
full success, so a failed migration is not marked as applied.

`pnpm db:push` needs `supabase login` first. Without a token the CLI fails with
`401 {"message":"Unauthorized"}` at "Initialising login role" — that is a missing
personal access token, not a schema problem, and it says nothing about whether
migrations are pending. A token comes from Project Settings → Access Tokens, or
can be passed for one command:

```sh
SUPABASE_ACCESS_TOKEN=sbp_... pnpm db:push
```

`pnpm db:migrate` deliberately **refuses** a Supabase Cloud target. It applies
files as plain SQL without recording anything in the platform's history, which
would leave the schema and the migration ledger disagreeing; the next `db push`
would then skip files it believed were already applied and report success. Use
one path per platform.

## Applying the schema through the Supabase MCP

The Supabase MCP server is the second supported path, and the one to reach for
when no CLI token is available. `supabase.apply_migration` calls
`POST /v1/projects/{ref}/database/migrations`, the same platform endpoint the CLI
uses, and maintains the same `supabase_migrations.schema_migrations` ledger. It
authenticates with the MCP server's own credentials, so it needs no `sbp_` token.

```text
supabase.apply_migration({ project_id: "<project-ref>",
                           name: "hims_baseline",          // snake_case, no timestamp
                           query: <the full contents of the .sql file> })
```

Apply files in filename order, one call per file, and read the file verbatim.
Backticks in SQL comments must be escaped if you pass the body through a
JavaScript template literal.

Verified behaviour, as opposed to documented behaviour:

- **A failed migration is not recorded.** Applying a migration out of order
  returned `42P01 relation does not exist` and left `list_migrations` empty, so
  the platform's record-only-on-success guarantee does hold through this path.
- **You must pass the whole file.** A migration has to be atomic; splitting one
  file across several calls produces one ledger entry per call and breaks the
  1:1 file-to-version mapping that `db push` relies on.
- **The platform assigns the version, and it is not the filename.** The endpoint
  takes only `name` and `query` and stamps the version as the current time. The
  local files are named with hand-chosen timestamps (`20260925000000_...`), so
  applying through the MCP *always* leaves the ledger holding versions that no
  filename matches. This is expected, not a mistake, and the guard below exists
  for it.
- **`supabase.execute_sql` records nothing.** Use it to read or to assert, never
  to apply a migration — that is `db:migrate`'s failure mode.

## The ledger guard

Because the MCP cannot be told which version to record, and the CLI derives it
from the filename, a project that has been migrated both ways will eventually
hold versions that match no file. `db push` applies every filename absent from
the ledger, so it would then re-run an already-applied migration and fail on the
first object that already exists.

That failure is survivable; the tempting response to it is not. Deleting the
ledger row discards the only record of what the database contains, and the next
push re-applies the whole chain. So the check runs *before* `db push` and refuses
instead:

```sh
pnpm db:verify-migration-ledger                       # read-only; non-zero on drift
pnpm db:reconcile-migration-ledger                   # repair drifted versions
```

`push-migrations.sh` calls the read-only check and never the repair. Repair is a
separate, explicit invocation because it is a write to a platform-owned table,
and the only thing it will ever do is rename a version to match the file that
declares it — it cannot mark an unapplied migration as applied. It refuses if a
target version is already occupied, and it aborts unless it renames exactly the
number of rows it found drifted, so a partial or surprising ledger stops the run
instead of being half-repaired.

It needs `psql` and `DATABASE_ADMIN_URL`, because the ledger is platform-owned.
Without `psql` it prints a warning and exits 0, so a workstation with no
PostgreSQL client keeps working; `db push` still fails loudly on its own if a
migration is genuinely unapplied.

Verified against the live project: with the ledger in step it reports 4 applied
and 0 pending; after mis-recording one version the way the MCP would, it reports
`1 drifted and 0 orphaned` and refuses; `--reconcile` restores the filename
version and the next check passes.

## Roles

`pnpm db:provision-app-role` creates the non-`BYPASSRLS` application role
(`hims_app` by default) and grants it `USAGE` on the `hims_*` schemas. It runs as
the Supabase `postgres` role, which on a cloud project holds `BYPASSRLS` and can
create roles — that is the correct role for the job and the wrong role for the
API.

Then verify:

```sh
HIMS_TENANT_ID=<seed tenant uuid> pnpm db:verify-rls
```

The application role connects through the pooler as `hims_app.<project-ref>`, not
as `hims_app` — the pooler requires the ref in the username. That is the single
most common reason a cloud connection is rejected after a correct password.

## Seeding

`pnpm db:seed` creates a demo tenant and is development data. It refuses any
non-local host, so against a cloud project it stops and asks for an explicit
opt-in:

```sh
HIMS_ALLOW_REMOTE_SEED=1 pnpm db:seed
```

Read that refusal as a question, not an obstacle. Supabase Cloud's hosted
projects are where real patient data will live, and a demo tenant inserted into
a project that already holds it is a data-quality incident, not a convenience.

## Resetting

`pnpm db:reset` rebuilds the `hims_*` schemas for a plain-PostgreSQL
development database. It refuses a cloud project outright, for the same ledger
reason `db:migrate` does. Use:

```sh
supabase db reset --linked
```

That drops and recreates the **entire** project database, not just the HIMS
tables, and clears the migration history in the same operation.

## Important operational rules

- **Keep the service/secret key server-side.** `SUPABASE_SERVICE_ROLE_KEY` must
  never reach a browser or mobile bundle, in either the legacy `service_role`
  JWT form or the newer `sb_secret_` form.
- **Do not use the `postgres` database role as the API connection.** On a cloud
  project it holds `BYPASSRLS`, which makes every row-level security policy in
  the HIMS baseline inert. See [ADR-0003](../../doc/ADR/0003-database-role-and-rls.md).
- **The Data API is a public endpoint.** `https://<ref>.supabase.co/rest/v1/` is
  reachable from the internet and served to the `anon` and `authenticated`
  roles. The HIMS baseline grants neither role any privilege on a `hims_*`
  table, so patient data is not readable through it — but the schema is
  discoverable there, and a future grant would expose PHI at a public URL. If
  nothing in the stack uses the Data API, disable it in Project Settings → API
  rather than relying on the absence of grants as the control.
- **Direct database connections are IPv6-only** unless the project has the paid
  IPv4 add-on. The pooler is IPv4. Prefer the pooler, and treat
  `DATABASE_URL` pointing at `db.<ref>.supabase.co` as something to verify
  against the project's network settings rather than assume.
- **TLS is mandatory.** `loadEnv` refuses to start a process whose
  `SUPABASE_URL` is a cloud host while `DATABASE_SSL` is off, so the insecure
  combination cannot reach a deployment by accident.

## Reachability check

```sh
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable key> \
  bash infra/supabase/smoke-test.sh
```

Checks Auth, Storage and the Data API are reachable. The key is optional: without
it the script still checks the first two and reports `SKIP rest` rather than
failing, because an unauthenticated `rest/v1/` request is expected to be rejected
by the gateway.
