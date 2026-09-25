import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from '@hims/config';

import { DatabaseModule } from './core/database/database.module.js';
import { QueueModule } from './core/queues/queue.module.js';
import { ProcessingModule } from './processing/processing.module.js';

/**
 * The integration worker's composition root.
 *
 * Note what is *not* here: no HTTP controllers, no `ThrottlerModule`, no
 * `SwaggerModule`, no CORS. An integration gateway is entered by Redis,
 * not by a socket, so everything the API needs to answer a request is
 * dead weight in this process.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // `.env` is a convenience for local development; every value can equally
      // come from the platform (Kubernetes ConfigMap/Secret, ECS task
      // definition), which take precedence over the file.
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      // The same schema `loadEnv` uses, so every injected `ConfigService.get`
      // returns the coerced boolean or number rather than a raw string.
      validate: (config) => loadEnv(config as NodeJS.ProcessEnv),
    }),

    DatabaseModule,
    QueueModule,
    ProcessingModule,
  ],
})
export class AppModule {}
