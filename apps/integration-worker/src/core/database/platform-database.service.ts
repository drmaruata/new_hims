import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * Cross-tenant database access for integration dispatch.
 *
 * See `@hims/worker`'s equivalent for the rationale: the outbox relay
 * and integration dispatch are platform work spanning every tenant and
 * get their own pool on a role with BYPASSRLS.
 */
@Injectable()
export class PlatformDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformDatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_PLATFORM_URL');

    if (!connectionString) {
      throw new Error(
        'DATABASE_PLATFORM_URL is not set. Integration dispatch needs a role with BYPASSRLS.'
      );
    }

    this.pool = new Pool({
      connectionString,
      max: this.configService.get<number>('PLATFORM_POOL_MAX', 4),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  async onModuleInit(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query<{ bypassrls: boolean }>(
        'SELECT rolbypassrls AS bypassrls FROM pg_roles WHERE rolname = current_user'
      );
      if (!rows[0]?.bypassrls) {
        this.logger.error(
          'The DATABASE_PLATFORM_URL role does not have BYPASSRLS. Cross-tenant dispatch will return zero rows.'
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
   * Return every ACTIVE integration for a tenant.
   */
  async findActiveIntegrations(tenantId: string): Promise<PlatformIntegration[]> {
    const { rows } = await this.pool.query<PlatformIntegration>(
      `SELECT id, integration_code, integration_type, vendor, protocol,
              endpoint, secret_ref, status
         FROM hims_integration.integrations
        WHERE tenant_id = $1 AND status = 'ACTIVE'`,
      [tenantId]
    );
    return rows;
  }

  /**
   * Create a new outbound message record and return its id.
   */
  async createMessage(data: CreateMessageParams): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO hims_integration.messages (
          tenant_id, integration_id, message_id, message_type, direction,
          correlation_id, request_payload_ref, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
      [
        data.tenantId,
        data.integrationId,
        data.messageId,
        data.messageType,
        data.direction,
        data.correlationId ?? null,
        data.requestPayloadRef ?? null,
        data.status,
      ]
    );
    return rows[0].id;
  }

  /**
   * Record an attempt against a message and update the message status.
   */
  async recordAttempt(data: RecordAttemptParams): Promise<void> {
    await this.pool.query(
      `INSERT INTO hims_integration.message_attempts (
          tenant_id, message_record_id, attempt_number, result_status,
          error_code, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.tenantId,
        data.messageRecordId,
        data.attemptNumber,
        data.resultStatus,
        data.errorCode ?? null,
        data.errorMessage ?? null,
      ]
    );

    await this.pool.query(
      `UPDATE hims_integration.messages
          SET status = $2,
              sent_at = CASE WHEN $2 = 'SENT' THEN now() ELSE sent_at END,
              error_code = $3
        WHERE id = $1`,
      [data.messageRecordId, data.resultStatus, data.errorCode ?? null]
    );
  }

  /**
   * Move a message to DEAD_LETTER and record why.
   */
  async deadLetter(data: DeadLetterParams): Promise<void> {
    await this.pool.query(
      `INSERT INTO hims_integration.dead_letters (
          tenant_id, message_record_id, reason, first_failed_at, last_failed_at, replay_status
        ) VALUES ($1, $2, $3, now(), now(), 'PENDING')`,
      [data.tenantId, data.messageRecordId, data.reason]
    );

    await this.pool.query(
      `UPDATE hims_integration.messages SET status = 'DEAD_LETTER' WHERE id = $1`,
      [data.messageRecordId]
    );
  }

  /**
   * Generic query. Used for admin/maintenance statements.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }
}

// --- Param types ---

interface PlatformIntegration {
  id: string;
  integration_code: string;
  integration_type: string;
  vendor: string | null;
  protocol: string | null;
  endpoint: string | null;
  secret_ref: string | null;
  status: string;
}

export interface CreateMessageParams {
  tenantId: string;
  integrationId: string;
  messageId: string;
  messageType: string;
  direction: string;
  correlationId?: string | null;
  requestPayloadRef?: string | null;
  status: string;
}

export interface RecordAttemptParams {
  tenantId: string;
  messageRecordId: string;
  attemptNumber: number;
  resultStatus: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface DeadLetterParams {
  tenantId: string;
  messageRecordId: string;
  reason: string;
}
