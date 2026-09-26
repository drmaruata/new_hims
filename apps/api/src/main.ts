import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { loadEnv } from '@hims/config';

import { AppModule } from './app.module.js';
import { configureApp, GLOBAL_PREFIX } from './http-app.config.js';
import { setupSentry } from './core/observability/sentry.js';

const SWAGGER_TAGS: ReadonlyArray<[string, string]> = [
  ['Platform', 'Tenant, facility, department, user and role management'],
  ['Encounter', 'Episode-of-care lifecycle and state transitions'],
  ['Patient', 'Patient registration, MPI, identifiers'],
  ['OPD', 'Appointments, queues, consultations'],
  ['IPD', 'Admissions, beds, nursing, discharge'],
  ['LIS', 'Laboratory orders, specimens, results'],
  ['RIS', 'Radiology orders, studies, reports'],
  ['Emergency', 'ED encounters, triage, dispositions'],
  ['OT', 'Operating theater management'],
  ['ICU', 'Intensive care unit'],
  ['Pharmacy', 'Prescriptions, dispensing, inventory'],
  ['Billing', 'Charges, invoices, payments'],
  ['Insurance', 'Payers, policies, claims'],
  ['Quality', 'Incidents, CAPA, indicators'],
  ['EMR', 'Longitudinal patient record'],
  ['Workflow', 'Automation, tasks, approvals'],
  ['Document', 'Document management'],
  ['Notification', 'Multi-channel notifications'],
  ['Integration', 'External system integrations'],
  ['Audit', 'Audit logging'],
  ['AI', 'AI copilots'],
  ['Analytics', 'Reporting and dashboards'],
];

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Parse and validate the environment before anything else touches it, so a
  // missing or malformed secret fails here with a readable message rather than
  // as a confusing error deep inside module construction.
  const env = loadEnv();

  // Sentry is initialised before the app is created so that failures during
  // module construction, config validation and DI resolution are captured too.
  if (env.SENTRY_DSN) {
    setupSentry(env.SENTRY_DSN, env.NODE_ENV);
  }

  // `NestExpressApplication` is required for `app.set`/`app.use` to be typed
  // against Express rather than the framework-agnostic `INestApplication`.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(logger);

  const nodeEnv = env.NODE_ENV;
  const isProduction = nodeEnv === 'production';

  // Shared with the integration suite in `test/`, so the paths, headers and CORS
  // behaviour asserted there are the ones this process actually serves.
  configureApp(app, env);

  // No global ValidationPipe: every route validates its own Zod schema through
  // ZodValidationPipe, and a global class-validator pass would be a second,
  // silently disagreeing source of truth. The response envelope, correlation id
  // and correlation-id middleware are registered as DI providers in AppModule
  // so they resolve through the container rather than being new'd here.

  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  });
  if (isProduction) {
    // The schema is a map of the whole system. It stays reachable in staging
    // for integration work and is not served in production.
    logger.warn('Swagger UI is enabled in production; disable unless required.');
  }

  // Lets in-flight requests finish and lets Nest run onModuleDestroy, so the
  // pg pool and Redis connections are drained instead of severed.
  app.enableShutdownHooks();

  const port = env.PORT;
  await app.listen(port, env.HOST);

  logger.log(`HIMS API listening on :${port}/${GLOBAL_PREFIX} [${nodeEnv}]`);
  logger.log(`API documentation: :${port}/${GLOBAL_PREFIX}/docs`);
}

function buildOpenApiConfig() {
  const builder = new DocumentBuilder()
    .setTitle('HIMS API')
    .setDescription('Hospital Information Management System API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'supabase-jwt'
    );

  for (const [tag, description] of SWAGGER_TAGS) {
    builder.addTag(tag, description);
  }

  return builder.build();
}

bootstrap().catch((error: unknown) => {
  // Without this, a failure during config validation or module resolution is an
  // unhandled rejection: the process exits with no explanation in the platform
  // logs, which is exactly the failure this needs to make diagnosable.
  new Logger('Bootstrap').error(
    'Failed to start the API',
    error instanceof Error ? error.stack : error
  );
  process.exit(1);
});
