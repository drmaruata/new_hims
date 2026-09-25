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
- Tenant RLS has a repeatable verification script and CI gate.
- Backup, checksum verification and restore-drill scripts exist.
- OpenTelemetry/Prometheus/Grafana/Tempo local observability profile exists.
- CI validates lint, typecheck, unit tests, production build, schema migration and tenant isolation.
- Web root navigation now has a canonical /command-center route and all Phase 0 shell links resolve without dead 404s.
- Core shared packages now contain unit tests instead of passing through an empty test suite.
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

The CI workflow is the authoritative executable gate. A Phase 0 merge should not be treated as complete until the GitHub Actions quality and database-isolation jobs are green on this branch/PR.

The following remain organizational or pre-pilot gates rather than code defects:

- Formal written approval/designation of the first pilot hospital.
- Clinical governance committee sign-off.
- Production penetration test and external security review.
- Production DR certification and measured RPO/RTO.
- Production HA architecture and failover drill.

Phase 1 starts only after the CI/database gates are green and the pilot/governance decisions are recorded.
