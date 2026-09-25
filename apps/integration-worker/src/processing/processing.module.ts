import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { HIMS_QUEUES } from '@hims/domain-types';
import { IntegrationProcessor } from './integration.processor.js';
import { AdapterRegistry } from '../adapters/adapter.registry.js';
import { HttpAdapter } from '../adapters/http.adapter.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: HIMS_QUEUES.INTEGRATION }),
  ],
  providers: [
    IntegrationProcessor,
    AdapterRegistry,
    HttpAdapter,
  ],
})
export class ProcessingModule {}
