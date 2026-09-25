import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { DatabaseContext } from '@hims/database';

/**
 * Request-scoped values this service attaches to the Express request.
 *
 * Declared by merging into Express's `Request` rather than indexing with a
 * string, so a typo is a compile error instead of an `undefined` at runtime.
 * Every field is populated by a single owner:
 *
 *   correlationId  CorrelationIdMiddleware
 *   user           JwtAuthGuard
 *   dbContext      JwtAuthGuard
 */
declare global {
  namespace Express {
    interface Request {
      /** Trace id echoed to the client on `X-Correlation-Id`. */
      correlationId: string;
      /** Present once JwtAuthGuard has run; absent on `@Public()` routes. */
      user?: AuthenticatedUser;
      /** RLS scope for this request: tenant, actor and facility grants. */
      dbContext?: DatabaseContext;
    }
  }
}

export {};
