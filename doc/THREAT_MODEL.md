# HIMS Threat Model

Status: Phase 0 baseline
Date: 2026-09-26

Scope

The model covers the web/mobile clients, NestJS API, the managed Supabase Cloud project (PostgreSQL, Auth, Storage, Realtime and the Data API), Redis/workers, PACS/document services and external integrations.

Primary trust boundaries

1. Browser/mobile client to edge/API.
2. API to the Supabase Cloud database over the public internet — a boundary the self-hosted deployment did not have, since the database was once on the same host.
3. API/workers to Redis.
4. API to document/PACS/integration services.
5. Hospital network to external health/payer services.
6. Administrators to privileged configuration and support functions.
7. The public internet to the Supabase Data API, which is a separately reachable endpoint the HIMS application does not mediate.

Threats and controls

| Threat                | Example                                              | Phase 0 control                                                                                                            |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tenant breakout       | User changes tenant/facility header                  | Membership-backed scope + PostgreSQL RLS + CI isolation test                                                               |
| Credential theft      | Access token or service key leaked                   | Server-side secrets, JWT verification, no service key in clients                                                           |
| Privilege escalation  | User assigns self a role                             | Server-side permission evaluation; role management is privileged and audited                                               |
| Data exfiltration     | Bulk patient export                                  | Explicit export permission, audit, classification and approval workflow                                                    |
| Clinical tampering    | Released result overwritten                          | Immutable/versioned clinical model and audit trail                                                                         |
| Malicious upload      | Infected PDF/image                                   | ClamAV scanning before trusted document use                                                                                |
| Database bypass       | API connects as superuser                            | Dedicated hims_app role with NOBYPASSRLS                                                                                   |
| Queue abuse           | Cross-tenant background job                          | Job tenant scope and transaction-local RLS context                                                                         |
| Replay/duplication    | Integration message replay                           | Idempotency keys, message IDs and outbox contract                                                                          |
| Availability loss     | DB/Redis outage                                      | Health probes, backup/restore drills and operational runbooks                                                              |
| Secret exposure       | Credentials in repository                            | .env ignored, CI dependency/security gates, server-side secret policy                                                      |
| Observability leakage | PHI in logs                                          | Structured logging policy and data classification restrictions                                                             |
| Cleartext transport   | Database traffic sent unencrypted                    | TLS required for every database connection; startup fails when a Supabase Cloud URL is configured without it               |
| Data API exposure     | Patient data read at the public `/rest/v1/` endpoint | No `anon`/`authenticated` grant on any `hims_*` table; disable the Data API where unused; NestJS API is the only data path |
| Managed-platform role | `postgres` role used for application traffic         | `postgres` holds BYPASSRLS on a cloud project; `DATABASE_ADMIN_URL` is absent from the API and worker runtime              |

Security assumptions

- The Supabase project is configured with a region acceptable for the hospital's data-residency obligations, and the deployment team holds the account rather than a shared credential.
- Database connections are encrypted in transit, and the application pooler is used rather than the IPv6-only direct host.
- Hospital operators protect the Linux host and container runtime running the application and its supporting services. The database platform is operated by Supabase; see [ADR-0004](ADR/0004-supabase-cloud-managed-platform.md).
- TLS terminates at a controlled edge.
- Production secrets are stored outside Git and outside the Supabase client bundles.
- External integrations authenticate through managed credentials.
- Clinical governance defines who may use break-glass access.

Residual risks

Phase 0 does not claim complete penetration testing, formal legal certification, HA failover, or production DR certification. Those are pre-pilot/production-readiness gates.

Two risks are introduced by the managed platform and are not closed by it. The database, its backups and its availability are in Supabase's hands, so the hospital's recovery objectives depend on a service level this project does not control; restore testing against the platform's backup is therefore a production-readiness gate rather than an optional exercise. And development, CI and production share a single Supabase project, so a misdirected seed or migration reaches the same database that will hold real patient records; the `db:seed` and `db:reset` guards reduce this but do not remove it.
