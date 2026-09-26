---
applyTo: 'apps/web/**,packages/ui/**,packages/api-client/**,packages/auth/**,packages/localization/**'
description: 'Use when working on the Next.js web app, shared UI primitives, client-side data flows, auth, or localization.'
---

# Frontend conventions

- Keep UI composition in the web app and shared design-system primitives in [packages/ui](../../packages/ui/); avoid one-off styling patterns when a shared component already exists.
- Reuse shared contracts from `@hims/api-client`, `@hims/auth`, `@hims/localization`, and `@hims/validation` instead of duplicating client state or schema logic.
- Align with the existing Next.js app patterns and prefer established component conventions over ad hoc structure.
- Keep accessibility, responsiveness, and design-system consistency in mind when changing screens or shared UI building blocks.
- Validate with the app-scoped checks for the web app, usually `pnpm --filter @hims/web lint`, `pnpm --filter @hims/web typecheck`, and `pnpm --filter @hims/web build` when a change affects rendering or client contracts.
