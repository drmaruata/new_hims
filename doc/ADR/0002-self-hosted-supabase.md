# ADR-0002: Self-hosted Supabase as the platform layer

Status: Superseded by [ADR-0004](0004-supabase-cloud-managed-platform.md)
Date: 2026-09-26

Context

The development blueprint requires PostgreSQL, Auth, Realtime and Storage through a self-hosted Supabase platform while NestJS remains the business API.

Decision

Pin the upstream self-hosted Supabase Docker release through infra/supabase/.supabase-version and bootstrap the official Compose stack rather than copying a large upstream vendor file into the repository. Add HIMS migrations through a Compose overlay.

Consequences

- Supabase upgrades are explicit and reviewable.
- The HIMS repository owns only its overlay and schema.
- Auth, Realtime and Storage are operational services rather than mocked environment variables.
- Self-hosting responsibilities for security, backups, monitoring and upgrades remain with the operator.
