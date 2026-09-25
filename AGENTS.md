# AGENTS.md

## Purpose

This repository is a pnpm + Turborepo monorepo for a hospital information system. Keep changes aligned with the domain boundaries, shared package architecture, and app-specific tooling described in [README.md](README.md) and the docs in [doc/](doc/).

## Repository map

- [apps/api](apps/api): NestJS backend API and business logic.
- [apps/web](apps/web): Next.js web app.
- [apps/worker](apps/worker): background worker processes.
- [apps/clinician-mobile](apps/clinician-mobile): clinician/nurse Expo app.
- [apps/patient-mobile](apps/patient-mobile): patient-facing Expo app.
- [packages](packages): shared libraries such as domain types, validation, auth, telemetry, localization, and UI.
- [supabase](supabase): HIMS migrations, seed data, Edge Function boundary and database tests.
- [doc](doc): product, architecture, contracts, governance and schema docs.
- [infra](infra): Supabase, database-role, observability, backup and deployment baselines.

## Working conventions

- Prefer the workspace scripts in the root [package.json](package.json) for repo-level validation.
- When editing a specific app or package, prefer the relevant package-level script from that package's own package.json before broad repo-wide commands.
- Keep app code and package code separated. Shared contracts should live in the packages layer instead of being duplicated in app modules.
- Respect the existing domain boundaries: clinical, operational, financial, and integration concerns should stay organized and explicit.
- Use the documentation in [doc/](doc/) for requirements, APIs, and data contracts; do not invent schema or workflow conventions that conflict with them.

## Common commands

Run from the repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm db:migrate
pnpm db:seed
```

Typical validation pattern for a focused change:

```bash
pnpm --filter <target-app-or-package> lint
pnpm --filter <target-app-or-package> test
pnpm --filter <target-app-or-package> build
```

## Architecture and code expectations

- The repo is organized around a modular monolith pattern with clear app/package responsibilities, not ad hoc cross-app imports.
- Domain types and validation logic should be shared through packages, not redefined locally in the apps.
- UI work should align with the design system conventions already present in the web app and shared UI package.
- API and schema changes should be checked against the docs in [doc/](doc/) and the database migration patterns under [supabase](supabase).

## Before finishing work

- Check whether the relevant app/package has a targeted lint/test/build command.
- Verify the specific area changed; avoid claiming repo-wide success from a single package run.
- For Phase 0 changes, run the CI-equivalent quality and database isolation gates before declaring closeout.
- Keep fixes minimal and compatible with the monorepo conventions.

## Documentation links

- [README.md](README.md)
- [doc/API_CONTRACT.md](doc/API_CONTRACT.md)
- [doc/DATABASE_SCHEMA.md](doc/DATABASE_SCHEMA.md)
- [doc/PRD.md](doc/PRD.md)
- [doc/SRS.md](doc/SRS.md)
- [doc/PERMISSION_MATRIX.md](doc/PERMISSION_MATRIX.md)
