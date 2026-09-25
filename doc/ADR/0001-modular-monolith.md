# ADR-0001: Modular monolith as the HIMS application boundary

Status: Accepted
Date: 2026-09-26

Context

The HIMS contains many clinical and operational domains but they share patient identity, encounter, authorization, audit and transaction boundaries. Splitting them into independent services at Phase 0 would multiply deployment and consistency failure modes.

Decision

Use a NestJS modular monolith with explicit domain modules and shared platform packages. Domains communicate through application interfaces and domain events. Service extraction is permitted later only when independent scaling, isolation or ownership provides a demonstrated benefit.

Consequences

- One deployable API preserves transactional consistency.
- Domain ownership remains explicit.
- Background workers handle asynchronous work.
- The database remains authoritative for transactional clinical state.
- Future extraction requires stable contracts rather than a rewrite.
