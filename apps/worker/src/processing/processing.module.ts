import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { HIMS_QUEUES } from '@hims/domain-types';

import { DocumentsProcessor } from './documents.processor.js';
import { OutboxRelayService } from './outbox-relay.service.js';

/**
 * Every queue this process touches.
 *
 * The outbox relay produces into all of them and the document processor
 * consumes one, so they are declared together here. `BullModule.forRootAsync`
 * is global, so declaring a queue in this module is enough to get the shared
 * connection — no per-queue connection configuration anywhere.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: HIMS_QUEUES.NOTIFICATIONS },
      { name: HIMS_QUEUES.REPORTS },
      { name: HIMS_QUEUES.DOCUMENTS },
      { name: HIMS_QUEUES.EXPORTS },
      { name: HIMS_QUEUES.REMINDERS },
      { name: HIMS_QUEUES.ANALYTICS },
      { name: HIMS_QUEUES.EMR },
      { name: HIMS_QUEUES.AI },
      { name: HIMS_QUEUES.BULK_IMPORT },
      { name: HIMS_QUEUES.INTEGRATION }
    ),
  ],
  providers: [OutboxRelayService, DocumentsProcessor],
})
export class ProcessingModule {}
