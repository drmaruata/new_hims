import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from 'pg';

/**
 * Tenant scope for one unit of work.
 *
 * ## Why `tenantId` is required rather than optional
 *
 * This is the single most consequential line in the package.
 *
 * Every table in the baseline migration is protected by a policy of the form
 * `tenant_id = hims_current_tenant_id()`, and `hims_current_tenant_id()` reads
 * `NULLIF(current_setting('app.tenant_id', true), '')::uuid`. When the GUC is
 * unset that function returns `NULL`, and `tenant_id = NULL` is never true — so
 * an unscoped query returns **zero rows**, not all rows.
 *
 * That is the dangerous failure mode. An optional `tenantId?: string | null`
 * type-checks happily against a context built with nothing in it, and the
 * symptom is not an exception, it is an endpoint that reports "no patients
 * found" while the database is full of them. Making the field required means
 * that mistake is a compile error instead.
 *
 * The complementary guarantee is in `applyTenantContext`, which throws rather
 * than skipping the `set_config` when the value is empty. Belt and braces on
 * purpose: the type protects compile-time callers, the check protects a
 * `JSON.parse`d payload or any other value that arrived without a type.
 */
export interface DatabaseContext {
  /** UUID of the tenant this unit of work belongs to. Never empty. */
  tenantId: string;
  /** The facility in scope, when the work is facility-scoped. */
  facilityId?: string | null;
  /** The actor, for `hims_audit`. Not a permission. */
  userId?: string | null;
  /**
   * Facilities the caller may read, exposed as `app.facility_ids`.
   *
   * Separate from `facilityId`: "which facility am I acting in" and "which
   * facilities may I see" are different questions, and a read-only user has the
   * second without the first.
   */
  facilityIds?: readonly string[] | null;
  /** Tenant administrators may operate across all facilities in their tenant. */
  isTenantAdmin?: boolean;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private ready = false;

  constructor(
    private readonly configService: ConfigService,
    /**
     * Connection-pool size. Left at the API's `DATABASE_POOL_MAX` default
     * because the API is the only consumer today; a worker that wants a
     * different size sets it in its own `ConfigModule` and gets a different
     * pool from its own instantiation of this provider.
     */
    poolSizeKey = 'DATABASE_POOL_MAX',
  ) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required; refusing to fall back to a privileged PostgreSQL account');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: this.configService.get<number>(poolSizeKey, 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // The API role must NOT have BYPASSRLS, otherwise every policy in the
      // baseline migration is moot.
      options: '-c statement_timeout=15000 -c lock_timeout=5000',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const client = await this.pool.connect();
      try {
        const { rows } = await client.query<{ version: string }>(
          'SELECT version()',
        );
        this.logger.log(`Connected to ${rows[0].version.split(',')[0]}`);
        this.ready = true;
      } finally {
        client.release();
      }
    } catch (error) {
      // Do not crash the process: `/health/ready` reports the degraded state
      // and the rest of the platform (auth JWKS, redis, integrations) still
      // boots. A crash here would turn a database blip into a restart loop.
      this.logger.warn(
        `Initial database connection failed: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  isHealthy(): boolean {
    return this.ready;
  }

  /**
   * Liveness probe for the database.
   *
   * `SELECT 1` on purpose: it does not depend on any schema, so it answers
   * "can this process reach PostgreSQL", which is the question a readiness
   * probe is asking. It is not a substitute for a tenant-scoped read, and is
   * not used as one.
   */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply the RLS context to a client inside an open transaction.
   *
   * `set_config(..., true)` is transaction-local, so settings cannot leak to
   * the next request or job that reuses a pooled connection. This runs between
   * BEGIN and COMMIT on every `query` and `transaction` call, which is what
   * makes the isolation hold even when application code forgets an explicit
   * `WHERE tenant_id = $1`.
   */
  private async applyTenantContext(
    client: PoolClient,
    ctx: DatabaseContext,
  ): Promise<void> {
    assertDatabaseContext(ctx);

    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [
      ctx.tenantId,
    ]);
    if (ctx.userId) {
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [
        ctx.userId,
      ]);
    }
    if (ctx.facilityId) {
      await client.query(`SELECT set_config('app.facility_id', $1, true)`, [
        ctx.facilityId,
      ]);
    }
    if (ctx.facilityIds) {
      await client.query(`SELECT set_config('app.facility_ids', $1, true)`, [
        JSON.stringify(ctx.facilityIds),
      ]);
    }
    await client.query(`SELECT set_config('app.is_tenant_admin', $1, true)`, [
      ctx.isTenantAdmin ? 'true' : 'false',
    ]);
  }

  /**
   * Establish only the *user* half of the request context, leaving
   * `app.tenant_id` unset.
   *
   * Used exclusively by `queryForUser`. Because `app.tenant_id` stays unset,
   * `hims_current_tenant_id()` returns NULL and every `tenant_id = ...` policy
   * evaluates to false — so this can only ever return rows from a table that
   * carries a `user_id = hims_current_user_id()` policy. That is the safety
   * property, not an accident: forgetting the tenant makes the query return
   * nothing rather than everything.
   */
  private async applyUserContext(
    client: PoolClient,
    userId: string,
  ): Promise<void> {
    if (!userId) {
      throw new Error(
        'queryForUser requires a userId. It scopes on app.user_id, so an empty value would match no rows and look like a missing record rather than a bug.',
      );
    }
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
  }

  /** Run a single statement inside a transaction carrying the RLS context. */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
    ctx: DatabaseContext,
  ): Promise<QueryResult<T>> {
    return this.transaction(
      async (client) => client.query<T>(text, params as unknown[]),
      ctx,
    );
  }

  /**
   * Run `fn` inside a transaction carrying the RLS context.
   *
   * Use this for any read-modify-write sequence so a state transition is
   * atomic. Note that a *single* `query` is also wrapped in a transaction: that
   * is not overhead, it is the only way the GUCs can be set transaction-locally
   * and guaranteed not to survive onto the next borrower of the connection.
   */
  async transaction<T>(
    fn: (client: PoolClient) => Promise<T>,
    ctx: DatabaseContext,
  ): Promise<T> {
    return this.withConnection(
      (client) => this.applyTenantContext(client, ctx),
      fn,
    );
  }

  /**
   * Run a query scoped to a single authenticated user, before any tenant is
   * known.
   *
   * The one legitimate caller is the authentication bootstrap: listing which
   * tenants a user belongs to cannot be tenant-scoped, because the tenant is
   * precisely what the query exists to discover. It sets `app.user_id` and
   * deliberately leaves `app.tenant_id` unset, so it returns rows only on a
   * table whose SELECT policy allows `user_id = hims_current_user_id()` — today
   * exactly one, `hims_core.tenant_memberships`.
   *
   * Named so a grep finds every call site. It must not grow into a general
   * escape hatch from tenant scoping: a caller that already knows its tenant
   * should use `query`, which is what makes RLS hold.
   */
  async queryForUser<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[],
    userId: string,
  ): Promise<QueryResult<T>> {
    return this.withConnection(
      (client) => this.applyUserContext(client, userId),
      (client) => client.query<T>(text, params as unknown[]),
    );
  }

  /**
   * BEGIN, establish context, run `fn`, COMMIT — with rollback and connection
   * release handled in exactly one place so `transaction` and `queryForUser`
   * cannot drift apart on either.
   */
  private async withConnection<T>(
    applyContext: (client: PoolClient) => Promise<void>,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await applyContext(client);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await this.rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Convenience for single-row reads. */
  async one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
    ctx: DatabaseContext,
  ): Promise<T | null> {
    const { rows } = await this.query<T>(text, params, ctx);
    return rows[0] ?? null;
  }

  /**
   * ROLLBACK is best-effort.
   *
   * If the failure was a broken connection the rollback fails too, and the
   * original error is the one worth surfacing — a rollback error here would
   * replace a diagnosable failure with a confusing one.
   */
  private async rollbackQuietly(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken; the pool will discard it */
    }
  }
}
