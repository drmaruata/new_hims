import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { HIMS_QUEUES } from '@hims/domain-types';

import { PlatformDatabaseService, type PlatformOutboxEvent } from '../core/database/platform-database.service.js';
import { routeEvent } from '../routing/event-router.js';
import { EXPEDITED_JOB_OPTIONS } from './job-options.js';

/** Every queue the relay can publish into, injected by name. */
const PRODUCER_QUEUES = [
  HIMS_QUEUES.NOTIFICATIONS,
  HIMS_QUEUES.REPORTS,
  HIMS_QUEUES.DOCUMENTS,
  HIMS_QUEUES.EXPORTS,
  HIMS_QUEUES.REMINDERS,
  HIMS_QUEUES.ANALYTICS,
  HIMS_QUEUES.EMR,
  HIMS_QUEUES.AI,
  HIMS_QUEUES.BULK_IMPORT,
  HIMS_QUEUES.INTEGRATION,
] as const;

type ProducerQueueName = (typeof PRODUCER_QUEUES)[number];

/**
 * Drains `hims_workflow.outbox_events` into BullMQ. This is the "Outbox
 * publisher" in development.md §13.2, and the only thing in the system allowed
 * to turn a committed domain event into a queue job.
 *
 * ## Why a poll and not a trigger
 *
 * The alternative — `NOTIFY`/`LISTEN` — is faster and still wrong here, because
 * `NOTIFY` is delivered on commit and lost if the listener is not connected at
 * that instant. A committed clinical event that nobody heard about is the worst
 * possible outcome, so the queue is a poll over a durable table. The poll
 * interval is configuration, and 1s is a reasonable default for a hospital.
 *
 * ## The crash window, and why this is still correct
 *
 * Publishing is not transactional with PostgreSQL, so some ordering has to be
 * chosen between "the event is marked published" and "the job exists". The
 * ordering here is:
 *
 *   1. **Claim** — `FOR UPDATE SKIP LOCKED` flips a batch to `IN_FLIGHT` and
 *      commits. Several relay replicas can run this concurrently with no
 *      coordination: `SKIP LOCKED` hands each row to exactly one of them.
 *   2. **Enqueue** — every claimed event is published to its queue, keyed by
 *      `jobId = eventId`.
 *   3. **Mark** — only once every enqueue has been acknowledged are the rows
 *      flipped to `PUBLISHED`.
 *
 * The failure this leaves is a relay that dies between 2 and 3: the jobs exist
 * but the rows still say `IN_FLIGHT`. The sweeper returns those rows to
 * `PENDING` once they are old enough that the dead process is certainly gone,
 * and re-enqueues them under the *same* `jobId`. BullMQ refuses to add a second
 * job with an id it is still retaining, so the replay is a no-op rather than a
 * duplicate delivery — which matters because consumers are expected to be
 * idempotent but not infinitely so.
 *
 * The reverse ordering would be worse: mark `PUBLISHED` first and a crash loses
 * the event outright, with no trace.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly queues: Map<ProducerQueueName, Queue>;

  private timer: NodeJS.Timeout | null = null;
  /** Guards against overlapping ticks: the poll must never stack on itself. */
  private ticking = false;
  private draining = false;

  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly retentionDays: number;
  /**
   * How long a row may sit in `IN_FLIGHT` before the sweeper assumes its owner
   * is dead. Comfortably longer than one batch takes to enqueue, and short
   * enough that a crashed relay self-heals in minutes.
   */
  private readonly stuckAfterMinutes: number;
  private readonly maxPublishAttempts: number;

  constructor(
    @InjectQueue(HIMS_QUEUES.NOTIFICATIONS) private readonly notifications: Queue,
    @InjectQueue(HIMS_QUEUES.REPORTS) private readonly reports: Queue,
    @InjectQueue(HIMS_QUEUES.DOCUMENTS) private readonly documents: Queue,
    @InjectQueue(HIMS_QUEUES.EXPORTS) private readonly exportsQueue: Queue,
    @InjectQueue(HIMS_QUEUES.REMINDERS) private readonly reminders: Queue,
    @InjectQueue(HIMS_QUEUES.ANALYTICS) private readonly analytics: Queue,
    @InjectQueue(HIMS_QUEUES.EMR) private readonly emr: Queue,
    @InjectQueue(HIMS_QUEUES.AI) private readonly ai: Queue,
    @InjectQueue(HIMS_QUEUES.BULK_IMPORT) private readonly bulkImport: Queue,
    @InjectQueue(HIMS_QUEUES.INTEGRATION) private readonly integration: Queue,
    private readonly platformDb: PlatformDatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.queues = new Map<ProducerQueueName, Queue>([
      [HIMS_QUEUES.NOTIFICATIONS, this.notifications],
      [HIMS_QUEUES.REPORTS, this.reports],
      [HIMS_QUEUES.DOCUMENTS, this.documents],
      [HIMS_QUEUES.EXPORTS, this.exportsQueue],
      [HIMS_QUEUES.REMINDERS, this.reminders],
      [HIMS_QUEUES.ANALYTICS, this.analytics],
      [HIMS_QUEUES.EMR, this.emr],
      [HIMS_QUEUES.AI, this.ai],
      [HIMS_QUEUES.BULK_IMPORT, this.bulkImport],
      [HIMS_QUEUES.INTEGRATION, this.integration],
    ]);

    // `PRODUCER_QUEUES` and the injected queue set are two lists that must
    // agree. If a queue is declared but never injected, `this.queues.get(...)`
    // returns undefined and the relay silently drops that event type at publish
    // time — a lost-domain-event bug that reads as "there were no events".
    // Failing here turns it into a loud boot error instead.
    for (const name of PRODUCER_QUEUES) {
      if (!this.queues.has(name)) {
        throw new Error(
          `Outbox relay has no injected queue for "${name}". Add it to the constructor and to this.queues.`,
        );
      }
    }

    this.batchSize = this.configService.get<number>('WORKER_OUTBOX_BATCH_SIZE', 100);
    this.pollIntervalMs = this.configService.get<number>('WORKER_OUTBOX_POLL_MS', 1_000);
    this.retentionDays = this.configService.get<number>('OUTBOX_RETENTION_DAYS', 30);
    this.stuckAfterMinutes = this.configService.get<number>('OUTBOX_STUCK_MINUTES', 5);
    this.maxPublishAttempts = this.configService.get<number>(
      'OUTBOX_MAX_PUBLISH_ATTEMPTS',
      5,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    // One sweep at boot: a relay that was down for an hour has a backlog, and
    // waiting a full poll interval to notice is a pointless extra minute of lag.
    await this.runMaintenance();

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);

    // `unref` so a stray interval does not keep a process alive during a
    // graceful shutdown; Nest's shutdown hook clears it explicitly below.
    this.timer.unref();

    this.logger.log(
      `Outbox relay started: batch=${this.batchSize} every ${this.pollIntervalMs}ms, retention=${this.retentionDays}d`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Let an in-flight batch finish so the mark-published step is not skipped
    // and a whole batch has to be swept.
    while (this.ticking) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.logger.log('Outbox relay stopped');
  }

  /** One claim/enqueue/mark cycle. Exported for the sweep job and for tests. */
  async tick(): Promise<void> {
    if (this.ticking || this.draining) return;
    this.ticking = true;

    try {
      const events = await this.platformDb.claimOutboxEvents(
        this.batchSize,
        'outbox-relay tick',
      );
      if (events.length === 0) return;

      const published: string[] = [];

      for (const event of events) {
        try {
          await this.publish(event);
          published.push(event.event_id);
        } catch (error) {
          // One bad event must not abandon the rest of the batch. The row goes
          // back to PENDING (or to DEAD, once it has burned its attempts) with
          // the reason attached, and the batch carries on.
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to relay ${event.event_type} (${event.event_id}): ${message}`,
          );
          await this.platformDb.recordOutboxFailure(
            event.event_id,
            message,
            this.maxPublishAttempts,
            'outbox-relay publish failure',
          );
        }
      }

      if (published.length > 0) {
        await this.platformDb.markOutboxEventsPublished(
          published,
          'outbox-relay tick complete',
        );
      }

      this.logger.debug(
        `Relayed ${published.length}/${events.length} event(s) from the outbox`,
      );
    } catch (error) {
      // A database or Redis outage is not a reason to crash the worker. The
      // next tick retries, and the events stay PENDING because the claim
      // transaction never committed.
      this.logger.error(
        `Outbox relay tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.ticking = false;
    }
  }

  /** Publish one outbox event onto its route. */
  private async publish(event: PlatformOutboxEvent): Promise<void> {
    const route = routeEvent(event.event_type);

    if (!route) {
      // Thrown rather than skipped: the caller records it as a failure with a
      // reason, so an unroutable event accumulates attempts and lands in DEAD
      // with `last_error` explaining itself. Silently marking it published
      // would drop a committed domain event with no trace anywhere.
      throw new Error(
        `No route for event type "${event.event_type}". Add it to HIMS_EVENT_TYPES in @hims/domain-types and to EVENT_ROUTES in apps/worker.`,
      );
    }

    const queue = this.queues.get(route.queue as ProducerQueueName);
    if (!queue) {
      throw new Error(
        `Route for "${event.event_type}" names queue "${route.queue}", which this relay has no producer for.`,
      );
    }

    // `eventId` as the BullMQ job id is the deduplication key. It is what
    // makes the sweeper's replay a no-op, and what lets a caller re-publish an
    // event without producing two jobs.
    const correlationId = this.correlationIdFor(event);
    const facilityId = this.facilityIdFor(event);
    const actorUserId = this.actorUserIdFor(event);

    // `tenantId` is the field the whole design turns on: the processor applies
    // it as `app.tenant_id` before every statement, so a processor that forgets
    // a `WHERE` clause still cannot read another hospital's rows. It is taken
    // from the outbox row, never from the payload, because the row is written
    // inside the business transaction and the payload is not.
    await queue.add(
      route.job,
      {
        eventId: event.event_id,
        eventType: event.event_type,
        eventVersion: event.event_version,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        occurredAt: event.occurred_at.toISOString(),
        tenantId: event.tenant_id,
        ...(facilityId ? { facilityId } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        correlationId,
        payload: event.payload_jsonb,
      },
      {
        ...(route.expedite ? EXPEDITED_JOB_OPTIONS : {}),
        jobId: event.event_id,
      },
    );

    this.logger.debug(
      `Relayed ${event.event_type} -> ${route.queue}/${route.job} (${correlationId})`,
    );
  }

  /**
   * Recover rows a dead relay stranded, and prune published history.
   *
   * Cheap enough to run on every boot and periodically, which is what it does —
   * neither operation is urgent, and both are the kind of thing that silently
   * stops happening if they are only wired to a cron that someone later removes.
   */
  async runMaintenance(): Promise<void> {
    try {
      const requeued = await this.platformDb.requeueStuckOutboxEvents(
        this.stuckAfterMinutes,
        'outbox-relay boot sweep',
      );
      if (requeued > 0) {
        this.logger.warn(
          `Requeued ${requeued} outbox event(s) stranded in IN_FLIGHT for over ${this.stuckAfterMinutes} minutes`,
        );
      }

      const pruned = await this.platformDb.pruneOutboxEvents(
        this.retentionDays,
        'outbox-relay retention sweep',
      );
      if (pruned > 0) {
        this.logger.debug(
          `Pruned ${pruned} published outbox event(s) older than ${this.retentionDays} days`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Outbox maintenance failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Best-effort correlation id.
   *
   * The outbox table has no correlation column, so one is derived from the
   * payload when the publisher put it there and falls back to the event id. It
   * exists so a job's logs join the request that caused them; a missing one
   * degrades tracing, not correctness, so it is never a throw.
   */
  private correlationIdFor(event: PlatformOutboxEvent): string {
    return this.stringField(event, 'correlationId') ?? event.event_id;
  }

  /**
   * Facility scope, when the publisher recorded one.
   *
   * Optional throughout: a cross-facility event (a tenant-wide pharmacy recall)
   * has none, and inventing one would be worse than leaving it unset.
   */
  private facilityIdFor(event: PlatformOutboxEvent): string | undefined {
    return this.stringField(event, 'facilityId');
  }

  /** The user who caused the event, for the audit trail. Never a permission. */
  private actorUserIdFor(event: PlatformOutboxEvent): string | undefined {
    return this.stringField(event, 'actorUserId');
  }

  /**
   * Read one string field out of an untyped `jsonb` payload.
   *
   * The payload is `jsonb NOT NULL` with no documented shape, so every read
   * from it is a type check, not a cast. Returning `undefined` for anything
   * that is not a non-empty string means a malformed payload degrades to "no
   * facility scope" rather than putting `42` into a UUID column.
   */
  private stringField(event: PlatformOutboxEvent, key: string): string | undefined {
    const value = event.payload_jsonb?.[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
