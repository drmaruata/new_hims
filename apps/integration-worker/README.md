# @hims/integration-worker

Outbound integration gateway. Implements development.md §8.3.

Consumes the `hims.integration` queue, which is populated by the `OutboxRelayService`
in `@hims/worker`.

## Responsibility

1. Receives a domain event job.
2. Matches the event against configured `hims_integration.integrations`.
3. For each match, dispatches the event via an appropriate adapter (HTTP, HL7, FHIR, etc.).
4. Records message attempts and status in `hims_integration.messages` and `hims_integration.message_attempts`.
5. Handles dead-lettering of failed integrations.

## Configuration

Standard HIMS environment variables apply.

## Running

```bash
pnpm --filter @hims/integration-worker dev
pnpm --filter @hims/integration-worker build
pnpm --filter @hims/integration-worker start
```
