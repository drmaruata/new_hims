# HIMS Engineering Rules

- Preserve one canonical tenant-scoped patient identity (UHID/MPI).
- No direct client access to privileged database credentials.
- Business writes go through the NestJS API.
- Every tenant-owned table must carry tenant context and use RLS as defense in depth.
- Never rely on UI-only authorization.
- Finalized clinical records are immutable; corrections are amendments.
- High-risk clinical, financial, privacy, authorization and configuration actions are auditable.
- EMR is a longitudinal projection; source domains remain authoritative.
- No business logic in UI components.
- Use the HIMS Design System; extend shared components rather than creating one-off patterns.
- Never render raw JavaScript Date objects in React.
- Prefer configuration over customer-specific code forks.
- Destructive production migrations require an approved plan.
- AI is human-in-the-loop and must not autonomously finalize high-risk clinical decisions.
