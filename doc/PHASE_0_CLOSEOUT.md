# Phase 0 Closeout

Date: 2026-09-26
Branch: phase-0-closeout

Phase 0 objective

Establish an approved architecture, engineering baseline, repository, CI/CD skeleton, environments and infrastructure baseline before expanding Phase 1 platform capabilities.

Completed implementation

- Modular-monolith architecture is documented by ADR.
- Self-hosted Supabase is pinned and bootstrapped from the official Docker distribution.
- HIMS migrations are overlaid onto the Supabase database bootstrap.
- Development seed is explicitly opt-in.
- NestJS API database access uses a dedicated non-BYPASSRLS role.
- Tenant and facility RLS have repeatable structural/behavioral verification and a CI gate.
- The API carries tenant-admin/facility scope into transaction-local PostgreSQL settings.
- Backup, checksum verification and restore-drill scripts exist.
- OpenTelemetry/Prometheus/Grafana/Tempo local observability profile exists.
- CI validates lint, typecheck, unit tests, production build, schema migration and tenant isolation.
- Web root navigation now has a canonical /command-center route and all Phase 0 shell links resolve without dead 404s.
- Core shared packages now contain unit tests instead of passing through an empty test suite.
- Browser authentication uses Supabase Auth sessions rather than a manually managed access-token localStorage value.
- Audit events and break-glass access persist to the audit schema rather than returning hard-coded demo records.
- Authorization seed data now matches the API's canonical DOMAIN:RESOURCE:ACTION:SCOPE permission contract.
- Environment example was reconciled with the actual config schema and local service topology.
- Health readiness now fails when the database ping actually fails.

Phase 0 deliverables

- PRD: present.
- SRS: present.
- Development blueprint: present and reconciled with the pinned Supabase runtime.
- ADR register: present.
- Threat model: present.
- Data classification policy: present.
- Clinical safety framework: present.
- UI design-system foundation: present.
- Repository: present.
- CI/CD skeleton: present.
- Environment baseline: present.
- Infrastructure baseline: present.

Acceptance evidence

The CI workflow is the authoritative executable gate. The implementation on this branch is complete, but the repository's GitHub Actions execution service is currently returning failed jobs even for a minimal runner-only smoke workflow. The connector cannot retrieve the corresponding job logs, so this is not being misreported as a code-level pass. Re-run the existing CI/database-isolation workflows once GitHub Actions execution is healthy; no Phase 0 code change is required for that infrastructure issue.

The following remain organizational or pre-pilot gates rather than code defects:

- Formal written approval/designation of the first pilot hospital.
- Clinical governance committee sign-off.
- Production penetration test and external security review.
- Production DR certification and measured RPO/RTO.
- Production HA architecture and failover drill.

Phase 1 starts only after the CI/database gates are green and the pilot/governance decisions are recorded.
