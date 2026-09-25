# ADR-0003: Dedicated non-BYPASSRLS database role

Status: Accepted
Date: 2026-09-26

Context

PostgreSQL superusers and roles with BYPASSRLS defeat the tenant isolation controls implemented by the HIMS schema.

Decision

Migrations run through a separate administrative connection. The NestJS API connects as hims_app, a non-superuser, non-BYPASSRLS role with only SELECT/INSERT/UPDATE on HIMS schemas and no DELETE privilege.

Consequences

- RLS remains a real database boundary rather than a code comment.
- Cross-tenant access is testable in CI.
- Destructive schema/data operations require the separate migration/admin path.
- Role provisioning is explicit and repeatable.
