# HIMS Web Design System Foundation

Status: Phase 0 baseline
Date: 2026-09-26

Foundation

- Next.js + React + TypeScript.
- Tailwind CSS.
- Source-owned shadcn/ui primitives in packages/ui.
- Lucide icons.
- TanStack Table for dense clinical/operational grids where required.

Interaction rules

- Desktop/tablet first for staff workstations.
- Keyboard-friendly queues and data entry.
- Persistent patient identity context on clinical screens.
- Clear distinction between draft, active, finalized, cancelled and amended states.
- Destructive actions require confirmation and reason where applicable.
- Clinical alerts use semantic severity and do not depend on color alone.
- Tables support explicit loading, empty, error and stale-data states.
- Timestamps display facility timezone and retain ISO timestamps in the API.
- Money uses Indian locale/currency formatting.

Accessibility baseline

- WCAG 2.2 AA target for core workflows.
- Visible keyboard focus.
- Semantic labels and roles.
- Minimum touch targets appropriate to tablet workflows.
- Screen-reader text for icons where the icon is the only visual cue.
- No safety-critical meaning conveyed by color alone.

Component ownership

Foundational primitives live in packages/ui. Domain components such as PatientHeader, ClinicalAlert, VitalSignsPanel, BedBoard and CommandCenterWidget are HIMS-owned compositions.
