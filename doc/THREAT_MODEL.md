# HIMS Threat Model

Status: Phase 0 baseline
Date: 2026-09-26

Scope

The model covers the web/mobile clients, NestJS API, self-hosted Supabase services, PostgreSQL, Redis/workers, object storage, PACS/document services and external integrations.

Primary trust boundaries

1. Browser/mobile client to edge/API.
2. API to PostgreSQL/Supabase.
3. API/workers to Redis.
4. API to document/PACS/integration services.
5. Hospital network to external health/payer services.
6. Administrators to privileged configuration and support functions.

Threats and controls

| Threat | Example | Phase 0 control |
|---|---|---|
| Tenant breakout | User changes tenant/facility header | Membership-backed scope + PostgreSQL RLS + CI isolation test |
| Credential theft | Access token or service key leaked | Server-side secrets, JWT verification, no service key in clients |
| Privilege escalation | User assigns self a role | Server-side permission evaluation; role management is privileged and audited |
| Data exfiltration | Bulk patient export | Explicit export permission, audit, classification and approval workflow |
| Clinical tampering | Released result overwritten | Immutable/versioned clinical model and audit trail |
| Malicious upload | Infected PDF/image | ClamAV scanning before trusted document use |
| Database bypass | API connects as superuser | Dedicated hims_app role with NOBYPASSRLS |
| Queue abuse | Cross-tenant background job | Job tenant scope and transaction-local RLS context |
| Replay/duplication | Integration message replay | Idempotency keys, message IDs and outbox contract |
| Availability loss | DB/Redis outage | Health probes, backup/restore drills and operational runbooks |
| Secret exposure | Credentials in repository | .env ignored, CI dependency/security gates, server-side secret policy |
| Observability leakage | PHI in logs | Structured logging policy and data classification restrictions |

Security assumptions

- Hospital operators protect the underlying Linux host and container runtime.
- TLS terminates at a controlled edge.
- Production secrets are stored outside Git.
- External integrations authenticate through managed credentials.
- Clinical governance defines who may use break-glass access.

Residual risks

Phase 0 does not claim complete penetration testing, formal legal certification, HA failover, or production DR certification. Those are pre-pilot/production-readiness gates.
