import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { loadEnv } from '@hims/config';

import { AppModule } from './app.module.js';
import { setupWorkerSentry } from './core/observability/sentry.js';

/**
 * Service name in the observability backends.
 *
 * Distinct from `hims-api` and `hims-worker` because all three
 * share one Sentry project: without this, an integration failure is
 * indistinguishable from an API one at 3am.
 */
const SERVICE_NAME = 'hims-integration-worker';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Validate the environment before anything touches it, so a missing or
  // malformed setting fails here with a readable message instead of as a
  // confusing error deep inside module construction.
  const env = loadEnv();

  // Initialised before the application is created, so failures during module
  // construction, config validation and DI resolution are captured too.
  if (env.SENTRY_DSN) {
    setupWorkerSentry(env.SENTRY_DSN, env.NODE_ENV, SERVICE_NAME);
  }

  // `createApplicationContext`, not `NestFactory.create`: there is no HTTP
  // server to start. BullMQ's workers and the integration dispatcher are
  // started by Nest's lifecycle hooks either way.
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(logger);

  // Runs `onModuleDestroy` and `onApplicationShutdown` on SIGTERM, which is
  // what drains the pg pool, closes the BullMQ connections and — importantly —
  // lets an in-flight batch finish marking its messages instead of
  // stranding them.
  app.enableShutdownHooks();

  logger.log(
    `HIMS integration worker started [${env.NODE_ENV}] concurrency=${env.WORKER_CONCURRENCY}`
  );
}

bootstrap().catch((error: unknown) => {
  // Without this, a failure during config validation or module resolution is an
  // unhandled rejection: the process exits with no explanation in the platform
  // logs, which is exactly the failure this needs to make diagnosable.
  new Logger('Bootstrap').error(
    'Failed to start the integration worker',
    error instanceof Error ? error.stack : error
  );
  process.exit(1);
});
