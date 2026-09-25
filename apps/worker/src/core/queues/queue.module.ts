import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { createRedisConnectionOptions } from './redis.js';

/**
 * Retry and retention policy applied to every job this worker produces.
 *
 * `attempts: 5` with exponential backoff from 2s spans roughly two minutes of
 * retries, which is chosen to outlast a database failover or a Redis restart
 * without sitting on a genuinely dead job for long.
 *
 * `removeOnComplete: { age: 3600 }` keeps an hour of finished jobs. A job is
 * not deleted the instant it finishes because a producer that retries an
 * enqueue after a network blip has to be able to find the job it already
 * created; deleting immediately turns that retry into a duplicate delivery.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400 },
};

/**
 * The process-wide BullMQ connection.
 *
 * `BullModule.forRootAsync` is a **global** module, so this is the only place
 * the connection is configured. A feature module that needs a queue declares it
 * with its own `BullModule.registerQueue({ name })` and inherits the connection
 * from here — which is why this module deliberately does not try to register or
 * export every queue itself. Centralising the list would mean two places to
 * update and a queue registered but never injected.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: createRedisConnectionOptions(configService),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
  ],
})
export class QueueModule {}
