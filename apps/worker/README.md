# @hims/worker

Background job process. Implements the `apps/worker` half of development.md
§8.2: everything that must not happen on a request path.

Separate process from day one, not a later extraction. It shares a database and
a Redis with `apps/api` and nothing else — no shared memory, no in-process calls
across the boundary. That is what lets it be restarted or scaled without a
single request being dropped.

## What runs here

| Queue | Responsibility (§8.2) | Processor |
|---|---|---|
| `hims.outbox` | Drains `hims_workflow.outbox_events` into the queues below | `OutboxRelayService` |
| `hims.documents` | Document processing | `DocumentsProcessor` |
| `hims.notifications` | Notification sending | *not built* |
| `hims.reports` | Report generation | *not built* |
| `hims.exports` | Data export | *not built* |
| `hims.reminders` | Scheduled reminders | *not built* |
| `hims.analytics` | Analytics ingestion | *not built* |
| `hims.emr` | Patient 360 projections | *not built* |
| `hims.ai` | Non-critical AI tasks | *not built* |
| `hims.bulk-import` | Bulk imports | *not built* |
| `hims.integration` | Enqueue only — consumed by `apps/integration-worker` | n/a |

"Not built" is not a stub that silently succeeds. Those queues are registered and
their events are routed and enqueued today; they simply accumulate jobs until a
processor exists, which is the intended state for a queue being rolled out
domain by domain. BullMQ's retention settings bound the backlog.

## The outbox relay

The only thing in the system allowed to turn a committed domain event into a
queue job. Read development.md §13.2 first; the ordering guarantee is written
out at length in `src/processing/outbox-relay.service.ts` because it is the part
that is easy to get subtly wrong.

Two things are worth knowing before changing it:

- **`EVENT_ROUTES` is exhaustive.** It is typed `Record<HimsEventType, ...>`,
  so adding an event to `HIMS_EVENT_TYPES` without giving it a destination is a
  build error. An event with no route is never dropped — it accumulates attempts
  and lands in `DEAD` with the reason in `last_error`.
- **The relay is cross-tenant and says so.** It uses `PlatformDatabaseService`
  on a `DATABASE_PLATFORM_URL` role with `BYPASSRLS`, because draining an
  outbox cannot be scoped to one tenant. Everything else in this process uses
  the RLS-scoped `DatabaseService` and carries a `tenantId` from the job payload.
  See that service's header for why the two are separate classes.

## Configuration

Beyond the shared env contract in `@hims/config`:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_PLATFORM_URL` | — | **Required.** Role with `BYPASSRLS` for outbox drain and retention sweep. Must not be `DATABASE_URL`. |
| `WORKER_CONCURRENCY` | `10` | Jobs in flight per processor. |
| `WORKER_OUTBOX_BATCH_SIZE` | `100` | Events claimed per poll. |
| `WORKER_OUTBOX_POLL_MS` | `1000` | Poll interval. |
| `OUTBOX_RETENTION_DAYS` | `30` | Published events are pruned after this. |
| `OUTBOX_STUCK_MINUTES` | `5` | `IN_FLIGHT` age before the sweeper assumes a dead relay. |
| `OUTBOX_MAX_PUBLISH_ATTEMPTS` | `5` | Relay failures before an event goes `DEAD`. |
| `WORKER_POOL_MAX` | `10` | Tenant-scoped pool size. |
| `PLATFORM_POOL_MAX` | `4` | Cross-tenant pool size. |
| `CLAMAV_BASE_URL` | — | Without it, documents are never marked scanned. |

## Running

```bash
pnpm --filter @hims/worker dev     # watch build + run
pnpm --filter @hims/worker build
pnpm --filter @hims/worker start
```

## What a processor has to do before it is finished

The pattern `DocumentsProcessor` follows, and the reason each step is there:

1. **Call `jobContext(job)` first.** It validates `tenantId` and throws if it is
   missing. A job that runs unscoped reads zero rows under RLS and writes
   results derived from nothing.
2. **Guard on current state, not on a marker.** There is no "did I already do
   this" table. The row's status is the marker: `WHERE status = 'UPLOADING'`
   makes a replay a no-op.
3. **Distinguish "nothing to do" from "failed".** Return `skipped` for a
   document that is already in the target state. Throw only for a condition a
   retry can fix.
4. **Never treat a job payload as a permission.** `actorUserId` is for the audit
   trail (EVENT_CATALOGUE.md §3.8). Re-authorize if the work is on a user's
   behalf.
5. **Do not put clinical content in a job payload.** Jobs live in Redis and are
   visible in `redis-cli`. Carry identifiers and storage references; read the
   content from PostgreSQL under the job's tenant scope.
