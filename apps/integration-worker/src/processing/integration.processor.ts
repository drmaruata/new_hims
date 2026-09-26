import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { HIMS_QUEUES } from '@hims/domain-types';
import { DatabaseService } from '@hims/database';
import { PlatformDatabaseService } from '../core/database/platform-database.service.js';
import { jobContext } from './job-context.js';
import { WORKER_CONCURRENCY } from './worker-concurrency.js';
import { AdapterRegistry } from '../adapters/adapter.registry.js';

@Processor(HIMS_QUEUES.INTEGRATION, { concurrency: WORKER_CONCURRENCY })
export class IntegrationProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly platformDb: PlatformDatabaseService,
    private readonly adapterRegistry: AdapterRegistry
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const ctx = jobContext(job);
    const data = job.data as { eventType?: string; eventId?: string; correlationId?: string };

    const integrations = await this.platformDb.findActiveIntegrations(ctx.tenantId);

    if (integrations.length === 0) {
      this.logger.debug(`No active integrations for tenant ${ctx.tenantId}`);
      return;
    }

    for (const integration of integrations) {
      try {
        await this.dispatch(integration, data, ctx);
      } catch (error) {
        this.logger.error(
          `Failed to dispatch to ${integration.integration_code}: ${(error as Error).message}`
        );
        // One failed integration does not block others for the same event.
        // Dead-lettering is handled inside dispatch.
      }
    }
  }

  private async dispatch(
    integration: Awaited<ReturnType<PlatformDatabaseService['findActiveIntegrations']>>[number],
    event: { eventType?: string; eventId?: string; correlationId?: string },
    ctx: { tenantId: string; facilityId?: string | null }
  ): Promise<void> {
    const messageId = `msg_${event.eventId ?? 'unknown'}_${integration.id.slice(0, 8)}`;

    const messageRecordId = await this.platformDb.createMessage({
      tenantId: ctx.tenantId,
      integrationId: integration.id,
      messageId,
      messageType: event.eventType ?? integration.integration_code,
      direction: 'OUTBOUND',
      correlationId: event.correlationId,
      status: 'PENDING',
    });

    const adapter = this.adapterRegistry.getAdapter(integration.integration_type);
    if (!adapter) {
      const error = `No adapter found for type ${integration.integration_type}`;
      await this.platformDb.recordAttempt({
        tenantId: ctx.tenantId,
        messageRecordId,
        attemptNumber: 1,
        resultStatus: 'FAILED',
        errorCode: 'NO_ADAPTER',
        errorMessage: error,
      });
      throw new Error(error);
    }

    try {
      await adapter.send(integration, event);
      await this.platformDb.recordAttempt({
        tenantId: ctx.tenantId,
        messageRecordId,
        attemptNumber: 1,
        resultStatus: 'SENT',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.platformDb.recordAttempt({
        tenantId: ctx.tenantId,
        messageRecordId,
        attemptNumber: 1,
        resultStatus: 'FAILED',
        errorCode: 'DISPATCH_ERROR',
        errorMessage: message,
      });
      throw error;
    }
  }
}
