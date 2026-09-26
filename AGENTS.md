# AGENTS.md

Instructions for coding agents working in this repository. This file is the root
instruction set and applies to the whole workspace. Path-scoped supplements live in
[.github/instructions/](.github/instructions/); when they conflict with this file, this file wins.

## Purpose

This repository is a pnpm + Turborepo monorepo for a hospital information system.
Keep changes aligned with the domain boundaries, shared package architecture, and
app-specific tooling described in [README.md](README.md) and the docs in [doc/](doc/).

## Non-negotiable rules

Read this section before touching any file. These are not style preferences.

1. **Look up current official documentation with the Context7 MCP server before
   writing code that depends on a library, framework, SDK, CLI, or platform
   behavior.** Do not write framework code from memory. See
   [Context7 is mandatory](#context7-is-mandatory).
2. **Load the relevant skill before writing code.** Match the work area to a skill
   in [Skills are mandatory](#skills-are-mandatory) and read it first. Do not
   discover a skill's contents by trial and error.
3. **Shared contracts live in `packages/`, not in app code.** Domain types,
   validation schemas, auth policies, date/time, localization and telemetry must be
   extended in the shared package, never re-declared inside an `apps/*` module.
4. **No ad-hoc cross-app imports.** `apps/*` never import each other. Cross-domain
   behavior goes through a shared package, an explicit application interface, or a
   domain event.
5. **Every tenant-owned database read and write runs with tenant context set.**
   The API connects as a non-`BYPASSRLS` role; an unscoped query returns zero rows
   rather than an error. See [Database and migration rules](#database-and-migration-rules).
6. **`doc/` is the source of truth for contracts.** Schema, API and permission
   changes must be reconciled with [doc/DATABASE_SCHEMA.md](doc/DATABASE_SCHEMA.md),
   [doc/API_CONTRACT.md](doc/API_CONTRACT.md), [doc/PERMISSION_MATRIX.md](doc/PERMISSION_MATRIX.md)
   and [doc/openapi.yaml](doc/openapi.yaml). Never invent a schema or workflow
   convention that contradicts them.
7. **Never commit secrets, credentials, or real patient data.** No
   `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or PHI in code, fixtures,
   snapshots, logs, or test data. Reference [.env.example](.env.example) instead.
8. **Claim only what you verified.** Report the exact commands you ran and their
   result. Never describe repo-wide success from a single package run, and never
   describe untested code as working.

## Mandatory tool workflow

Follow this order for every non-trivial change:

```text
1. Classify the work area   ->  load the matching skill(s)
2. Look up the library docs ->  Context7 (resolve-library-id, then query-docs)
3. Read the local sources   ->  doc/, existing code, existing patterns
4. Plan the smallest change ->  state the approach before editing
5. Implement                ->  follow existing conventions
6. Validate                 ->  targeted lint / typecheck / test / build
7. Report                   ->  what changed, what was verified, what was not
```

Steps 1 and 2 are not optional and are not satisfied by recalling documentation
from training data. This workspace pins deliberately unusual versions (TypeScript 6,
Next.js 16, React 19, Tailwind v4, NestJS 12, Zod 4, Vitest 5, Expo SDK 57 /
React Native 0.86), so remembered APIs are frequently wrong here.

### Context7 is mandatory

Use the `context7` MCP server for **any** question about how a library, framework,
SDK, API, CLI tool, or cloud service is supposed to work. This includes API syntax,
configuration, version-specific behavior, breaking changes, migration steps, and
debugging that depends on library semantics.

Procedure:

1. Call `context7.resolve-library-id` with the library name and your intent.
2. Call `context7.query-docs` with the returned `libraryId` and **one scoped
   concept per query**. Do not ask about a whole framework in a single query.
3. Cite what you found in your final report when the answer influenced the code.

Do not use Context7 for: refactoring, writing scripts from scratch, debugging your
own business logic, code review, or general programming concepts.

When you need the project's own architecture rather than a library's, prefer
[doc/](doc/) — and where a doc makes a claim about a library's current supported
behavior, confirm that claim with Context7 before relying on it.

IDs verified on 2026-09-26 for this stack. `resolve-library-id` remains
authoritative — re-resolve when you need a version-specific or newer ID.

| Area                                         | Context7 library ID                  |
| -------------------------------------------- | ------------------------------------ |
| Next.js 16 (App Router, caching, RSC)        | `/vercel/next.js`                    |
| React 19                                     | `/reactjs/react.dev`                 |
| Tailwind CSS v4                              | `/tailwindlabs/tailwindcss.com`      |
| shadcn/ui                                    | `/shadcn-ui/ui`                      |
| NestJS 12                                    | `/nestjs/docs.nestjs.com`            |
| Supabase (Auth, RLS, Realtime, Storage, CLI) | `/supabase/supabase`                 |
| PostgreSQL                                   | `/websites/postgres`                 |
| Zod 4                                        | `/colinhacks/zod`                    |
| TanStack Query                               | `/tanstack/query`                    |
| TanStack Table                               | `/tanstack/table`                    |
| Expo SDK 57                                  | `/expo/expo`                         |
| React Native 0.86                            | `/react/react-native`                |
| Vitest 5                                     | `/vitest-dev/vitest`                 |
| MSW                                          | `/mswjs/msw`                         |
| BullMQ                                       | `/taskforcesh/bullmq`                |
| date-fns / date-fns-tz                       | `/date-fns/date-fns`, `/date-fns/tz` |
| Turborepo                                    | `/vercel/turborepo`                  |
| pnpm (workspace, catalog, overrides)         | `/pnpm/pnpm`                         |
| openapi-typescript                           | `/openapi-ts/openapi-typescript`     |

Never put API keys, passwords, credentials, patient data, or proprietary code into
a Context7 query.

### Skills are mandatory

Before writing code, load every skill that matches the work area using the skill
tool. Reading the skill first is cheaper than debugging a convention you did not
know existed.

| Work area                                              | Skills to load                                 |
| ------------------------------------------------------ | ---------------------------------------------- |
| Any library/framework question                         | `context7-mcp`                                 |
| `apps/web`, Next.js App Router, RSC, routing, metadata | `next-best-practices`, `next-cache-components` |
| Next.js major-version upgrade                          | `next-upgrade`                                 |
| `apps/web` or `packages/ui` components, forms, tables  | `shadcn`, `shadcn-ui`                          |
| Tailwind v4 utilities, variants, config                | `tailwind-4-docs`                              |
| Any React component, hook, or render path              | `vercel-react-best-practices`                  |
| Shared component APIs, prop design, composition        | `vercel-composition-patterns`                  |
| `apps/clinician-mobile`, `apps/patient-mobile`, Expo   | `vercel-react-native-skills`                   |
| Supabase, PostgreSQL, migrations, RLS, queries         | `supabase-postgres-best-practices`             |
| UI review, accessibility, UX audit                     | `web-design-guidelines`                        |
| OpenCode configuration, plugins, MCP, permissions      | `opencode`                                     |
| Reporting an OpenCode bug                              | `report`                                       |
| A work area with no matching skill                     | `find-skills`                                  |

Notes:

- Load multiple skills when the change spans areas; the table is not exclusive.
- `ant-design-react`, `fastapi-*`, `pydantic`, and `pytest` are **not** used in this
  repository. The web app is shadcn/ui + Tailwind v4; the API is NestJS +
  TypeScript with Jest/Vitest.
- If no listed skill fits and you need one, use `find-skills` to locate and
  install it rather than improvising.
- Follow the loaded skill's guidance, and note explicitly in your report when you
  knowingly deviate from it and why.

## Repository map

- [apps/api](apps/api) — NestJS backend API and canonical business logic (`@hims/api`).
- [apps/web](apps/web) — Next.js 16 web app (`@hims/web`).
- [apps/worker](apps/worker) — BullMQ background worker (`@hims/worker`).
- [apps/integration-worker](apps/integration-worker) — external integration worker (`@hims/integration-worker`).
- [apps/clinician-mobile](apps/clinician-mobile) — clinician/nurse Expo app (`@hims/clinician-mobile`).
- [apps/patient-mobile](apps/patient-mobile) — patient-facing Expo app (`@hims/patient-mobile`).
- [packages/domain-types](packages/domain-types) — types across the clinical, operational, financial and quality domains.
- [packages/validation](packages/validation) — Zod schemas for commands and entities.
- [packages/database](packages/database) — pooled `pg` access, tenant context, non-`BYPASSRLS` role.
- [packages/auth](packages/auth) — RBAC/ABAC policies and token utilities.
- [packages/api-client](packages/api-client) — typed client for web and mobile.
- [packages/ui](packages/ui) — HIMS design system on shadcn/ui + Tailwind v4.
- [packages/date-time](packages/date-time) — safe date/time and clinical formatting.
- [packages/localization](packages/localization) — dictionaries, Indian locale and currency helpers.
- [packages/telemetry](packages/telemetry) — OpenTelemetry, correlation IDs, structured logging.
- [packages/clinical-safety](packages/clinical-safety) — allergy, interaction and critical-alert rules.
- [packages/config](packages/config) — shared TypeScript, ESLint and Prettier config.
- [supabase/migrations](supabase/migrations) — authoritative relational schema.
- [supabase/config.toml](supabase/config.toml) — Supabase CLI project config; the link target for `db:push`.
- [supabase/seed](supabase/seed) — opt-in development seed data.
- [supabase/functions](supabase/functions), [supabase/tests](supabase/tests) — Edge Function boundary and database tests.
- [infra/db](infra/db) — migration runner, cloud push wrapper, application and platform role provisioning, RLS verification.
- [infra/docker](infra/docker) — the shared image recipe for the API and both workers.
- [infra/backup](infra/backup), [infra/monitoring](infra/monitoring) — operational baselines.
- [infra/supabase](infra/supabase) — Supabase Cloud project setup and reachability check.
- [scripts](scripts) — repo tooling, including the unscoped-DB-call finder.
- [doc](doc) — product, architecture, contract, governance and schema docs.
- [.github/instructions](.github/instructions) — path-scoped agent instructions.

## Working conventions

- Prefer the workspace scripts in the root [package.json](package.json) for repo-level validation.
- When editing a specific app or package, use that package's own `package.json`
  scripts via `pnpm --filter <name> <script>` before falling back to broad
  repo-wide commands. Not every package defines every script — check first.
- Respect the existing domain boundaries: clinical, operational, financial, quality
  and integration concerns stay organized and explicit. Every table, service, API
  and business rule has one clear domain owner.
- The architecture is a modular monolith with hard domain boundaries
  (ADR-0001). NestJS modules map to domains, not to controllers, and the domain
  layer must not depend on ORM or transport concerns.
- UI work must build on [packages/ui](packages/ui) and the patterns already in
  [apps/web](apps/web). Do not introduce a second styling system.
- Frontend code must never render a raw JavaScript `Date`. Convert through
  [packages/date-time](packages/date-time) at the presentation boundary; store
  timestamps in UTC.
- All dependency versions are pinned through the `catalog:` in
  [pnpm-workspace.yaml](pnpm-workspace.yaml). Never add a bare version range to a
  package `package.json`; add or bump it in the catalog and explain why when a
  deliberate exception is unavoidable.
- Match the surrounding code: naming, file layout, comment density, error handling
  and test style. Read neighboring files before writing new ones.
- Write comments for the "why", not the "what". Clinical and safety-critical
  intent must be stated where a future reader could otherwise break it.

### Per-area supplements

Read the matching file in [.github/instructions/](.github/instructions/) when you
work in that area:

- [backend.instructions.md](.github/instructions/backend.instructions.md) — `apps/api`, `apps/worker`, `apps/integration-worker`, `packages/`, `supabase/`.
- [frontend.instructions.md](.github/instructions/frontend.instructions.md) — `apps/web`, `packages/ui`, `packages/api-client`, `packages/auth`, `packages/localization`.

## Common commands

Run from the repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format
pnpm format:check
pnpm db:push
pnpm db:seed
pnpm db:provision-app-role
pnpm db:provision-platform-role
pnpm db:verify-rls   # needs HIMS_TENANT_ID
pnpm db:verify-migration-ledger    # needs DATABASE_ADMIN_URL and psql
pnpm db:reconcile-migration-ledger # the same, but renames drifted ledger versions
pnpm db:migrate      # plain PostgreSQL only; refuses a cloud target
pnpm db:reset        # destructive; needs HIMS_DB_RESET_CONFIRM=1
```

The three Node services can also run as containers.
[infra/docker/Dockerfile.app](infra/docker/Dockerfile.app) is one recipe
parameterised by app directory, and [docker-compose.yml](docker-compose.yml)
puts `api`, `worker` and `integration-worker` behind an `apps` profile so the
supporting services still start without them:

```bash
docker compose up -d                          # Redis, Orthanc, Gotenberg, ClamAV, Mailpit, OpenSearch
docker compose --profile apps up -d --build   # ...and the API and both workers
```

Compose passes an explicit allow-list of variables to those containers rather
than `env_file`, so `DATABASE_ADMIN_URL` never enters a service runtime, and it
rewrites the supporting-service URLs to Compose service names. `DATABASE_URL`,
`DATABASE_PLATFORM_URL` and the Supabase keys are interpolated from the host
`.env`, so nothing is baked into an image and `.dockerignore` keeps the
filled-in `.env` files out of the build context.

The platform layer is a **managed Supabase Cloud project** (see
[ADR-0004](doc/ADR/0004-supabase-cloud-managed-platform.md)). No Supabase stack
runs from this repository. Read
[infra/supabase/README.md](infra/supabase/README.md) for project setup.

`db:push` and `db:migrate` are not interchangeable, and each refuses the target
belonging to the other. `supabase db push` records applied versions in
`supabase_migrations.schema_migrations`; `migrate.sh` records nothing and replays
the whole chain. Applying a migration through the wrong one leaves the schema and
the platform's history disagreeing, after which `db push` silently skips work
while reporting success. Use `db:push` for the cloud project and `db:migrate`
only for the plain-PostgreSQL CI job.

The `db:*` scripts are thin wrappers over the shell scripts in
[infra/db](infra/db) and need `bash` on the path. They are deliberately not
Turborepo tasks: a task that matches no package still reports success, so a
`turbo run db:migrate` with nothing to run would look like a migration that had
happened.

Targeted validation pattern for a focused change:

```bash
pnpm --filter <package> lint
pnpm --filter <package> typecheck
pnpm --filter <package> test
pnpm --filter <package> build
```

Workspace package names for `--filter`:

```text
@hims/api                 @hims/domain-types    @hims/clinical-safety
@hims/web                 @hims/validation      @hims/config
@hims/worker              @hims/database        @hims/ui
@hims/integration-worker   @hims/date-time       @hims/api-client
@hims/clinician-mobile    @hims/localization    @hims/auth
@hims/patient-mobile      @hims/telemetry
```

Database isolation tooling:

```bash
node scripts/find-unscoped-db-calls.mjs apps/api/src
```

## Database and migration rules

- Migrations live in [supabase/migrations](supabase/migrations), are numbered
  `YYYYMMDDHHMMSS_name.sql`, and are applied to the Supabase Cloud project by
  `pnpm db:push`. Never edit a migration that has already been applied; add a new
  one.
- [infra/db/migrate.sh](infra/db/migrate.sh) replays the whole chain in filename
  order and is **not** incremental: run it once per plain-PostgreSQL database,
  never as an "apply pending changes" step. It refuses to start when the HIMS schema is
  already present, and refuses a Supabase Cloud target outright. Do not mount
  migrations as Postgres init scripts, and do not add a second migration entry
  point — a divergent path is how a partially applied schema happens.
- The cloud project is the single source of truth for its own schema version, in
  `supabase_migrations.schema_migrations`. A schema change is deployed either by
  `supabase db push` or by the Supabase MCP server's `apply_migration`; anything
  that applies SQL without recording a version has desynchronised it. The MCP
  endpoint cannot be told which version to record, so a migration applied that
  way always lands in the ledger under a timestamp its filename does not use.
  The one thing in this repository that writes to that table is
  `db:reconcile-migration-ledger`, and only to rename a drifted version back to
  its filename — never to mark an unapplied migration as applied. Run
  `pnpm db:verify-migration-ledger` before trusting either path; `db:push` runs
  that check itself and refuses to push onto a drifted ledger.
- [infra/db/seed.sh](infra/db/seed.sh) creates a demo tenant. It is development
  only and refuses a non-local host unless `HIMS_ALLOW_REMOTE_SEED=1`.
  [infra/db/reset-db.sh](infra/db/reset-db.sh) is destructive, drops every
  `hims_*` schema, requires `HIMS_DB_RESET_CONFIRM=1`, and refuses a cloud
  target — use `supabase db reset --linked` for that.
- Connect through the connection pooler. A direct connection to the project
  database is IPv6-only without the paid IPv4 add-on, and the pooler requires the
  project ref in the username (`hims_app.<ref>`, not `hims_app`).
- Every database connection is encrypted in transit. `DATABASE_SSL` is applied by
  `withDatabaseTls` in [packages/database](packages/database), and `loadEnv`
  refuses to start a process whose `SUPABASE_URL` is a cloud host while TLS is
  off. Do not add a `Pool` that skips that helper.
- psql does not interpolate `:variables` inside a dollar-quoted string. A
  `:'var'` written into a `DO $$ ... $$` block reaches PL/pgSQL verbatim and
  fails to parse. Generate such statements with `format()` in a plain `SELECT`
  and dispatch them with `\gexec`, or pass the value in via `current_setting()`.
- The API must connect as the provisioned non-`BYPASSRLS` application role, never
  as `postgres` and never with a superuser or `service_role` credential. On a
  Supabase Cloud project the `postgres` role is not a superuser but _does_ hold
  `BYPASSRLS`, so the same rule applies by a different mechanism. See
  [infra/db/README.md](infra/db/README.md) and ADR-0003.
- The application role has `SELECT`/`INSERT`/`UPDATE` and no `DELETE`. Clinical
  deletion is expressed as an amendment, cancellation, or retirement workflow.
- Tenant and facility context must be established transactionally before any
  tenant-owned table is touched, and must not leak across pooled connections.
- Never issue a bare `db.query(...)` / `db.one(...)` outside tenant context. Under
  RLS it returns zero rows and looks like missing data rather than a security bug.
  Run the finder script above after touching database access.
- Enable RLS on every new tenant-owned table, with a policy, and add or extend the
  verification in [infra/db/verify-rls.sh](infra/db/verify-rls.sh).
- Keep seed data, [doc/DATABASE_SCHEMA.md](doc/DATABASE_SCHEMA.md) and
  [doc/supabase_schema.sql](doc/supabase_schema.sql) consistent with migrations.
  Seed data is opt-in and must never be applied to production.
- Audit columns follow [doc/development.md](doc/development.md) §10.5. Do not apply
  generic soft deletion to clinical records.
- No external network calls inside long database transactions. Use the
  transactional outbox for downstream effects.

## Security, privacy and clinical safety

- Treat all clinical data as regulated: no PHI in logs, fixtures, snapshots,
  comments, or test data. Use synthetic records only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, admin JWT secrets, or database
  credentials to web or mobile clients. Authorization claims come from
  server-side application metadata or database-backed role/scope tables, never
  from user-editable `user_metadata`.
- Authorization is RBAC + ABAC + clinical context. A clinical role does not imply
  access to every patient record; the treating relationship, facility, department
  and encounter all constrain access. Keep the permission notation
  `DOMAIN:RESOURCE:ACTION:SCOPE` consistent with
  [doc/PERMISSION_MATRIX.md](doc/PERMISSION_MATRIX.md).
- Break-glass access is explicit, requires a captured reason, and is logged at
  elevated severity.
- Clinical safety outranks convenience. A faster UI is not an acceptable reason
  to weaken identity confirmation, allergy visibility, order verification, result
  acknowledgement, critical-value escalation, auditability, provenance, or role
  separation. Route relevant checks through
  [packages/clinical-safety](packages/clinical-safety).
- Finalized clinical history is immutable. Corrections create traceable amendments
  that retain the original value, reason, actor and timestamp.
- Every API surface defines authentication, authorization, request/response schema,
  validation, idempotency, audit, rate limits, error codes, pagination, correlation
  ID, and tenant/facility context. Do not return stack traces to clients.
- For anything touching authentication, authorization, tenant isolation, PHI
  handling, or external integrations, also read [doc/THREAT_MODEL.md](doc/THREAT_MODEL.md)
  and [doc/DATA_CLASSIFICATION.md](doc/DATA_CLASSIFICATION.md).

## Testing expectations

- New behavior ships with tests. Bug fixes ship with a test that fails before the
  fix and passes after it.
- Match the framework already used in the package: Jest in [apps/api](apps/api)
  (config at [apps/api/jest.config.cjs](apps/api/jest.config.cjs), compiler options
  at [apps/api/tsconfig.spec.json](apps/api/tsconfig.spec.json)) and Vitest across
  [packages/](packages/). Do not introduce a second runner. The config is `.cjs`
  because `apps/api` is an ES module package, and the spec tsconfig pins
  `module: CommonJS` because ts-jest's default preset emits CommonJS. Several
  apps (`web`, `worker`, `integration-worker`, both mobile apps) have no `test`
  script yet; adding one means also adding the runner config, so raise it rather
  than inventing a local setup.
- `apps/api` runs two separate Jest projects and they must not be able to satisfy
  each other. Unit specs live under `src` and run against
  [apps/api/jest.config.cjs](apps/api/jest.config.cjs). Integration specs live
  under `test`, are named `*.e2e-spec.ts`, and run against
  [apps/api/jest-e2e.config.cjs](apps/api/jest-e2e.config.cjs) via
  `pnpm test:e2e`. An integration spec boots a real Nest application and drives
  it over HTTP with supertest, so it is where a global prefix, response envelope,
  correlation id or security-header change has to be proven. A `test` suite may
  not depend on PostgreSQL, Redis, Supabase or the network: fake the dependency
  in a `@Global()` module so the container can still resolve it.
- `apps/api`'s Jest scripts must keep `--experimental-vm-modules`. It is not
  redundant. The Nest packages ship ESM entry points, and Jest needs the flag to
  load them from a CommonJS-compiled spec; removing it fails every suite with
  "Must use import to load ES Module". The scripts pair it with
  `--disable-warning=ExperimentalWarning` so the required flag does not also
  print a warning on every run. Silence that specific warning only — never
  `--no-warnings`.
- A package that declares a `test` script must have at least one test file.
  Vitest exits 1 on "No test files found", and under Turborepo that first
  failure aborts the sibling tasks, so one empty package is reported as a
  whole-workspace red with unrelated `^C` noise. The same applies to a
  `test:e2e` task: a Turborepo task that matches no package still succeeds, so
  a green `pnpm test:e2e` is not evidence that any e2e coverage exists.
- A Turborepo task must not declare `outputs` no package produces. A task that
  writes only to stdout declares `outputs: []`, like `lint` and `typecheck`;
  declaring `coverage/**` when nothing runs coverage produces a
  "no output files found" warning per package on every run.
- Cover the failure and boundary cases, not just the happy path: validation
  rejection, authorization denial, cross-tenant denial, idempotent retry, and
  clinical-safety rule outcomes.
- Tests must be deterministic and must not depend on network access, wall-clock
  time, or a shared database with residual state.
- Never weaken or delete an existing test to make a change pass. If a test is
  genuinely wrong, fix it in the same change and say so explicitly in your report.

## Before finishing work

- Re-read the diff. Remove debug logging, commented-out code, stray files, and
  unrelated formatting churn.
- Confirm the change is the smallest change that solves the stated problem. Do not
  expand scope, rename unrelated symbols, or reformat untouched code.
- Run the targeted checks for every package you touched, then the repo-level gates
  if the change is cross-cutting.
- For schema, API, or permission changes, confirm the documentation in `doc/` is
  updated in the same change.
- If a change contradicts a Phase 0 architectural invariant, record a new ADR in
  [doc/ADR/](doc/ADR/) and update the register before implementing.
- If you could not run a check, say so plainly. Never report an unrun check as
  passing.

### Definition of done

```text
[ ] Relevant skill(s) loaded before writing code
[ ] Context7 used for every library/framework behavior relied on
[ ] Shared contracts placed in packages/, not in app code
[ ] doc/ contracts reconciled for schema/API/permission changes
[ ] No secrets, credentials, or PHI introduced
[ ] Targeted lint + typecheck + test (+ build) run and passing
[ ] Tests added for new behavior, including failure paths
[ ] Database isolation verified if database access changed
[ ] Final report states what changed, what was verified, and what was not
```

### Reporting results

State, in order: what you changed and why, the commands you actually ran with
their results, the Context7 lookups and skills that shaped the implementation,
and any deviation from these instructions with the reason. Distinguish clearly
between "verified", "not run", and "outstanding".

## Documentation links

- [README.md](README.md) — architecture overview and quick start.
- [doc/development.md](doc/development.md) — production architecture and engineering standards.
- [doc/API_CONTRACT.md](doc/API_CONTRACT.md) and [doc/openapi.yaml](doc/openapi.yaml) — API surface.
- [doc/DATABASE_SCHEMA.md](doc/DATABASE_SCHEMA.md) and [doc/supabase_schema.sql](doc/supabase_schema.sql) — schema.
- [doc/PRD.md](doc/PRD.md) — product requirements.
- [doc/SRS.md](doc/SRS.md) — software requirements.
- [doc/PERMISSION_MATRIX.md](doc/PERMISSION_MATRIX.md) — roles and permissions.
- [doc/CLINICAL_SAFETY_FRAMEWORK.md](doc/CLINICAL_SAFETY_FRAMEWORK.md) — clinical safety rules.
- [doc/UI_DESIGN_SYSTEM.md](doc/UI_DESIGN_SYSTEM.md) — design system foundation.
- [doc/THREAT_MODEL.md](doc/THREAT_MODEL.md) and [doc/DATA_CLASSIFICATION.md](doc/DATA_CLASSIFICATION.md) — security posture.
- [doc/EVENT_CATALOGUE.md](doc/EVENT_CATALOGUE.md) — domain events.
- [doc/ADR/](doc/ADR/) — architecture decision records.
- [infra/db/README.md](infra/db/README.md) — database bootstrap and isolation.
