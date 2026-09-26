# ADR-0004: Supabase Cloud as the managed platform layer

Status: Accepted
Date: 2026-09-26
Supersedes: ADR-0002

Context

ADR-0002 committed the project to a self-hosted Supabase Docker stack, with this
repository pinning the upstream release and supplying a HIMS migration overlay.
That decision has a cost the original record understates: self-hosting makes the
operator responsible for security, backups, disaster recovery, monitoring,
availability and scaling of the platform that holds patient data.

Supabase Cloud makes Supabase responsible for those, and exposes the same
PostgreSQL, Auth, Realtime and Storage services over a public API. The HIMS
domain model, the NestJS API, the non-`BYPASSRLS` application role and the RLS
baseline are all unaffected: nothing in the schema or the application depends on
who operates the database.

Two things do change. The database is reached over the network rather than a
container network, so TLS becomes mandatory. And Supabase records which
migrations have been applied in `supabase_migrations.schema_migrations`, which
gives the project the incremental migration story its own runner never had.

The same project serves development and production. This was considered and
rejected in favour of simplicity: separating them would double the credential
surface, the schema-promotion step and the drift detection, and the repository
already treats seeding and resetting as guarded, opt-in operations that refuse to
run against a shared host without an explicit override. The residual risk is
recorded in Consequences rather than left implicit — a single project means a
mistaken `db:seed` inserts a demo tenant into the same database that will hold
real patient records, and the two key sets cannot be rotated independently.

Decision

Use a managed Supabase Cloud project as the platform layer. Do not run a Supabase
stack in Docker. Apply migrations with `supabase link` + `supabase db push`, which
records applied versions and applies only pending files, and keep
`infra/db/migrate.sh` for the plain-PostgreSQL CI job that does not talk to
Supabase. Each runner refuses the target belonging to the other, because applying
a migration outside the platform's history table would desynchronise the schema
from `supabase_migrations.schema_migrations` and make a later `db push` skip work
while reporting success.

Connect through Supabase's connection pooler with TLS, and keep
`infra/db/provision-app-role.sh` as the way the application role is created.

Consequences

- Backups, disaster recovery, monitoring, patching and availability of the
  platform layer become Supabase's responsibility rather than the operator's.
- The database is off-host, so TLS is required. `loadEnv` fails startup when
  `SUPABASE_URL` is a cloud host and `DATABASE_SSL` is off, rather than trusting
  an operator to set it.
- Migrations become incremental and re-runnable, which removes the
  all-or-nothing constraint of the previous runner.
- The Supabase CLI becomes a required tool for the deployment path, and
  `SUPABASE_DB_PASSWORD` plus an access token become CI secrets.
- The Data API (`/rest/v1/`) is a public endpoint served to the `anon` and
  `authenticated` roles. The baseline grants neither role any privilege on a
  `hims_*` table, but relying on the absence of grants as the control is fragile;
  where the stack does not use it, the Data API should be disabled.
- Direct database connections are IPv6-only without the paid IPv4 add-on, so
  IPv4-only networks must use the pooler.
- One project for development and production leaves the two credential sets
  non-rotatable independently and makes a mis-seeded development run land in the
  production database. Revisit this if the project acquires a second environment
  or a real data-residency requirement.
- The platform's PostgreSQL version is whatever the project runs, not something
  this repository selects. It is checked with `show server_version` rather than
  pinned here.
