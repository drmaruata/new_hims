import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';

import { loadEnv, type AppEnv } from '@hims/config';
import { DatabaseService } from '@hims/database';

import { configureApp, GLOBAL_PREFIX } from '../../src/http-app.config.js';
import { HealthModule } from '../../src/core/health/health.module.js';
import { HttpExceptionFilter } from '../../src/core/filters/http-exception.filter.js';
import { TransformInterceptor } from '../../src/core/interceptors/transform.interceptor.js';
import { CorrelationIdMiddleware } from '../../src/core/middleware/correlation-id.middleware.js';

/**
 * Values that satisfy `loadEnv` without being credentials.
 *
 * `loadEnv` validates shape, not reachability: nothing here connects to
 * anything, so the suite needs no database, no Redis, no Supabase and no
 * network. They are the `replace-with-…` placeholders from `.env.example`, kept
 * obviously fake so they can never be mistaken for a real deployment value.
 */
const TEST_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  // Never used: `DatabaseService` is faked below.
  DATABASE_URL: 'postgresql://hims_app:replace-with-app-password@localhost:5432/hims_db',
  PATIENT_IDENTIFIER_HASH_KEY: 'replace-with-at-least-32-random-characters',
  SUPABASE_URL: 'http://localhost:8000',
  SUPABASE_ANON_KEY: 'replace-with-anon-key',
  SUPABASE_JWT_SECRET: 'replace-with-a-32-character-test-secret',
  CORS_ORIGIN: 'http://localhost:3000,http://localhost:8081',
  CORS_CREDENTIALS: 'true',
  TRUST_PROXY_HOPS: '1',
};

/**
 * The fake `DatabaseService`, in its own global module.
 *
 * Global because `HealthController` injects `DatabaseService` but `HealthModule`
 * does not import `DatabaseModule` — in the real graph `DatabaseModule` is
 * global. A provider listed on `HttpTestModule` would only be visible inside
 * `HttpTestModule`, so the container would still fail to resolve the
 * controller's third constructor argument.
 */
@Global()
@Module({
  providers: [{ provide: DatabaseService, useValue: { ping: async () => true } }],
  exports: [DatabaseService],
})
class FakeDatabaseModule {}

/**
 * An HTTP-only slice of `AppModule`.
 *
 * `AppModule` itself cannot be booted here: it imports `DatabaseModule` and
 * every domain module, and standing up a real pool would make the suite depend
 * on a database that AGENTS.md forbids tests from relying on. What is kept is
 * the part that decides what a client sees:
 *
 *   - `configureApp`  the real one, so the prefix, helmet headers and the CORS
 *     allow-list are the production values rather than a test's restatement
 *   - `CorrelationIdMiddleware`, `TransformInterceptor` and
 *     `HttpExceptionFilter`  the real classes, registered exactly as
 *     `AppModule` registers them
 *   - `HealthModule`  a real controller whose liveness route is `@Public()`
 *     and answers without touching a service
 *
 * `JwtAuthGuard` and `ThrottlerGuard` are the two registrations left out. Both
 * resolve their configuration through `ConfigModule`, which runs `loadEnv`
 * against the real `process.env`, so including them would make the suite depend
 * on a developer's local environment. Authentication and rate limiting are
 * covered by the `src/core/auth` unit specs; what this suite protects is the
 * envelope, the prefix and the header contract around them.
 */
@Module({
  imports: [FakeDatabaseModule, HealthModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
class HttpTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Same order and route pattern as `AppModule`, so the correlation id is set
    // before the guard, the interceptor and the filter all read it.
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}

export interface E2eApp {
  app: NestExpressApplication;
  /** The bound `http.Server` supertest drives. */
  httpServer: Server;
  env: AppEnv;
}

/**
 * Boot the application under test.
 *
 * `app.init()` rather than `app.listen()`: supertest drives the server through
 * an ephemeral port of its own choosing, so nothing here binds a fixed port and
 * two suites can never collide.
 */
export async function createE2eApp(): Promise<E2eApp> {
  // Parsed through the real schema so a change to the environment contract
  // fails this suite rather than only failing at deploy time.
  const env = loadEnv(TEST_ENV);

  const moduleRef = await Test.createTestingModule({ imports: [HttpTestModule] }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, env);
  await app.init();

  return { app, httpServer: app.getHttpServer() as Server, env };
}

export { GLOBAL_PREFIX };
