import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';

import type { AppEnv } from '@hims/config';

/**
 * API version lives in the global prefix rather than Nest's URI versioning, so
 * the path a client is written against is fixed at `/api/v1` and a future
 * `/api/v2` is added by mounting a second prefix, not by a decorator that can
 * be forgotten on a new controller.
 */
export const GLOBAL_PREFIX = 'api/v1';

/**
 * Everything that shapes the HTTP surface: trusted proxies, security headers,
 * compression, the CORS allow-list and the version prefix.
 *
 * Extracted from `main.ts` so the integration suite in `test/` boots the same
 * configuration the process does. A client-facing path, a CORS origin or a
 * security header that is only asserted against a hand-built test app is an
 * assertion about nothing; this is the one place the contract is written down.
 *
 * Note what is deliberately *not* here: the response envelope, correlation id
 * and error envelope are registered as DI providers in `AppModule` rather than
 * applied here, so they resolve through the container.
 */
export function configureApp(app: NestExpressApplication, env: AppEnv): void {
  // The API terminates TLS at the ingress but sits behind one or more proxies.
  // Without this, `req.ip` is the proxy's address, which collapses every
  // client's rate-limit bucket into one and makes client IPs in the audit log
  // useless. The hop count is configuration because the deployment decides how
  // many proxies there are; 0 means the app is exposed directly.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // Required so the Swagger UI page can load its inline stylesheet; the API
      // itself serves no user content, so this does not weaken the CSP above.
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(compression());

  app.enableCors({
    // An explicit allow-list, never `*`: the browser sends the Supabase session
    // cookie and a wildcard origin is rejected outright when credentials are on.
    origin: env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: env.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'X-Facility-Id',
      'Idempotency-Key',
      'If-Match',
    ],
    exposedHeaders: ['X-Correlation-Id', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 600,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX);
}
