import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { withDatabaseTls } from '@hims/database';

/**
 * Cross-tenant database access for infrastructure work.
 *
 * ## Why this is a separate service, and a separate connection
 *
 * Almost everything in this worker is tenant-scoped and goes through
 * `DatabaseService`, which sets `app.tenant_id` and lets row-level security do
 * the isolation. Two jobs cannot be done that way:
 *
 *  * draining `hims_workflow.outbox_events`, which by definition spans every
 *    tenant, and
 *  * sweeping integrations that a previous process left `IN_FLIGHT`.
 *
 * Both are platform work: they have no user, no facility and no single tenant.
 * Running them through `DatabaseService` would mean either faking a tenant id,
 * which is a lie the RLS policies would act on, or quietly widening the API's
 * role to read everything.
 *
 * So they get their own pool, on a **different role**, and the role is expected
 * to hold `BYPASSRLS`. That is a genuine privilege and the trade is worth
 * stating plainly: a drain cannot be scoped, and an unscoped drain under RLS
 * returns zero rows and looks like "no events" forever.
 *
 * Two invariants keep the blast radius at exactly this one class of query:
 *
 *  1. The connection string comes from `DATABASE_PLATFORM_URL`, never
 *     `DATABASE_URL`. The API's role must not have `BYPASSRLS`, or every policy
 *     in the baseline migration is decorative.
 *  2. Every method takes an explicit `reason` string that is logged with the
 *     statement. There is no generic `query()` escape hatch that a future
 *     caller can reach for by accident — adding a method here is a visible,
 *     reviewable act.
 */
@Injectable()
export class PlatformDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformDatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_PLATFORM_URL');

    if (!connectionString) {
      // Thrown at construction, not at first use. A worker that boots and then
      // finds an empty outbox is the worst failure mode here: it looks healthy,
      // reports "published 0 events", and quietly drops every domain event in
      // the system.
      throw new Error(
        'DATABASE_PLATFORM_URL is not set. The outbox relay and the dead-letter sweep are cross-tenant by nature and need a role with BYPASSRLS. Point DATABASE_PLATFORM_URL at a dedicated platform role — do not reuse DATABASE_URL, whose role must NOT have BYPASSRLS.'
      );
    }

    this.pool = new Pool(
      withDatabaseTls(
        {
          connectionString,
          // Small on purpose: this pool only ever runs short, indexed maintenance
          // statements, and a large one would compete with the API for connections
          // for no benefit.
          max: this.configService.get<number>('PLATFORM_POOL_MAX', 4),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        },
        this.configService.get<boolean>('DATABASE_SSL', false)
      )
    );
  }

  async onModuleInit(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Verified rather than assumed. If the role lacks BYPASSRLS the drain
      // silently reads nothing, so this is the difference between a loud
      // misconfiguration and a hospital that stops receiving events.
      const { rows } = await client.query<{ bypassrls: boolean }>(
        'SELECT rolbypassrls AS bypassrls FROM pg_roles WHERE rolname = current_user'
      );
      if (!rows[0]?.bypassrls) {
        this.logger.error(
          'The DATABASE_PLATFORM_URL role does not have BYPASSRLS. Cross-tenant reads will return zero rows. Grant it to this role only.'
        );
      } else {
        this.logger.log('Platform role verified: BYPASSRLS is set');
      }
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Claim up to `limit` unpublished outbox events, newest-last, and mark them
   * `IN_FLIGHT` in the same transaction.
   *
   * `FOR UPDATE SKIP LOCKED` is what makes several relay replicas safe: each
   * row is handed to exactly one of them without any of them blocking, so the
   * relay scales horizontally with no leader election and no distributed lock.
   *
   * The claim commits *before* the jobs are enqueued. That ordering is the
   * whole recovery story — see `OutboxRelayService`.
   */
  async claimOutboxEvents(limit: number, reason: string): Promise<PlatformOutboxEvent[]> {
    this.logger.debug(`claimOutboxEvents: ${reason}`);

    return this.transaction(async (client) => {
      const { rows } = await client.query<PlatformOutboxEvent>(
        `UPDATE hims_workflow.outbox_events o
            SET status        = 'IN_FLIGHT',
                attempt_count = o.attempt_count + 1
          WHERE o.event_id IN (
                SELECT event_id
                  FROM hims_workflow.outbox_events
                 WHERE status = 'PENDING'
                 ORDER BY occurred_at
                 LIMIT $1
                   FOR UPDATE SKIP LOCKED
              )
        RETURNING o.event_id, o.tenant_id, o.aggregate_type, o.aggregate_id,
                  o.event_type, o.event_version, o.payload_jsonb, o.occurred_at,
                  o.attempt_count`,
        [limit]
      );

      return rows;
    }, reason);
  }

  /**
   * Re-claim events stranded in `IN_FLIGHT`.
   *
   * A relay that dies between the claim and the enqueue leaves rows marked
   * `IN_FLIGHT` with nobody working on them. This returns them to `PENDING` once
   * they are old enough that the dead process is certainly gone. The
   * `stuckAfter` bound is what makes that safe: a live relay's in-flight batch
   * is seconds old, not minutes.
   */
  async requeueStuckOutboxEvents(stuckAfterMinutes: number, reason: string): Promise<number> {
    this.logger.debug(`requeueStuckOutboxEvents: ${reason}`);

    const { rowCount } = await this.query(
      `UPDATE hims_workflow.outbox_events
          SET status = 'PENDING'
        WHERE status = 'IN_FLIGHT'
          AND occurred_at < now() - make_interval(mins => $1)`,
      [stuckAfterMinutes],
      reason
    );

    return rowCount ?? 0;
  }

  /** Mark events as handed to the queues. */
  async markOutboxEventsPublished(eventIds: string[], reason: string): Promise<void> {
    if (eventIds.length === 0) return;
    this.logger.debug(`markOutboxEventsPublished: ${reason}`);

    await this.query(
      `UPDATE hims_workflow.outbox_events
          SET status       = 'PUBLISHED',
              published_at = now()
        WHERE event_id = ANY($1::uuid[])`,
      [eventIds],
      reason
    );
  }

  /**
   * Record a failed publish attempt and dead-letter the event once it has been
   * tried too many times.
   *
   * `DEAD` is a terminal state a replay has to clear deliberately
   * (EVENT_CATALOGUE.md §3.5), so a poison event stops retrying instead of
   * spinning forever and holding a batch slot.
   */
  async recordOutboxFailure(
    eventId: string,
    lastError: string,
    maxAttempts: number,
    reason: string
  ): Promise<void> {
    this.logger.debug(`recordOutboxFailure: ${reason}`);

    await this.query(
      `UPDATE hims_workflow.outbox_events
          SET status = CASE WHEN attempt_count >= $2 THEN 'DEAD' ELSE 'PENDING' END,
              last_error = left($3, 2000)
        WHERE event_id = $1`,
      [eventId, maxAttempts, lastError],
      reason
    );
  }

  /** Delete published events older than the retention window. */
  async pruneOutboxEvents(retentionDays: number, reason: string): Promise<number> {
    this.logger.debug(`pruneOutboxEvents: ${reason}`);

    const { rowCount } = await this.query(
      `DELETE FROM hims_workflow.outbox_events
        WHERE status = 'PUBLISHED'
          AND published_at < now() - make_interval(days => $1)`,
      [retentionDays],
      reason
    );

    return rowCount ?? 0;
  }

  /**
   * Escape hatch for maintenance statements that are not on a method yet.
   *
   * Named `adminQuery` and given a mandatory `reason` so a grep for privileged
   * access finds every call site. Prefer adding a named method: it can document
   * what it touches and can be reviewed as such.
   */
  async adminQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[],
    reason: string
  ): Promise<QueryResult<T>> {
    this.logger.warn(`adminQuery (BYPASSRLS): ${reason}`);
    return this.query<T>(text, params, reason);
  }

  /** Run `fn` in a transaction on the platform role. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>, reason: string): Promise<T> {
    // Logged because every method here takes a `reason` and the whole point of
    // the argument is that a grep for BYPASSRLS usage finds a labelled reason
    // for each one, not just the statement text.
    this.logger.debug(`transaction (BYPASSRLS): ${reason}`);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection already broken; the pool will discard it */
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[],
    reason: string
  ): Promise<QueryResult<T>> {
    this.logger.debug(`${reason}: ${text.split('\n')[0]?.trim() ?? ''}`);
    const client = await this.pool.connect();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }
}

/** A claimed row of `hims_workflow.outbox_events`, in snake_case as stored. */
export interface PlatformOutboxEvent {
  event_id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_version: number;
  payload_jsonb: Record<string, unknown>;
  occurred_at: Date;
  attempt_count: number;
}
