---
applyTo: 'apps/api/**,apps/worker/**,apps/integration-worker/**,packages/**,supabase/**'
description: 'Use when working on NestJS API modules, worker jobs, database behavior, validation, shared domain logic, or backend integrations.'
---

# Backend conventions

- Keep business logic in the appropriate package or NestJS module; avoid duplicating shared contracts in app code.
- Use existing shared libraries such as `@hims/domain-types`, `@hims/validation`, `@hims/database`, `@hims/auth`, and `@hims/telemetry` instead of re-declaring domain models locally.
- Respect the modular boundaries already in the API and workers; do not mix operational, financial, and clinical concerns in the same module.
- For schema or API changes, check the product docs in [doc/API_CONTRACT.md](../../doc/API_CONTRACT.md) and [doc/DATABASE_SCHEMA.md](../../doc/DATABASE_SCHEMA.md) before implementing behavior.
- Database changes should follow the migration conventions under [supabase](../../supabase/) and remain consistent with seed data and existing schema patterns.
- Validate with the package-scoped commands, typically `pnpm --filter @hims/api lint`, `pnpm --filter @hims/api test`, and `pnpm --filter @hims/api build`.
