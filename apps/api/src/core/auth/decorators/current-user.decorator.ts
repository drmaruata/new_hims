import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth.types.js';
import type { DatabaseContext } from '@hims/database';

type PrincipalRequest = Request & {
  user?: AuthenticatedUser;
  dbContext?: DatabaseContext;
};

/**
 * Injects the authenticated principal, or one of its fields:
 *
 * - `@CurrentUser()` → the whole `AuthenticatedUser`
 * - `@CurrentUser('tenantId')` → just the tenant
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<PrincipalRequest>().user;
    if (!user) return undefined;
    return field ? user[field as keyof AuthenticatedUser] : user;
  }
);

/**
 * Injects the request's RLS context, ready to hand to `DatabaseService`.
 *
 * Throws when the guard did not run, which happens only on a `@Public()` route.
 * The previous fallback here was `{} as DatabaseContext`, and it was a trap:
 * `DatabaseContext.tenantId` is required precisely because an absent tenant
 * makes every RLS policy evaluate to `tenant_id = NULL`, so every query returns
 * zero rows. A `@Public()` route that reached for `@DbContext()` would have
 * answered "no patients found" — indistinguishable from correct — while
 * reading nothing at all. A 500 is a better outcome than a confident empty
 * result.
 */
export const DbContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DatabaseContext => {
    const dbContext = context.switchToHttp().getRequest<PrincipalRequest>().dbContext;

    if (!dbContext) {
      throw new ForbiddenException(
        'This operation needs a tenant scope, but the request was not authenticated. Remove @Public() from the route, or resolve the tenant explicitly.'
      );
    }

    return dbContext;
  }
);

/**
 * Injects the resolved tenant id. Fails loudly rather than yielding `undefined`
 * so a missing scope can never be mistaken for "all tenants".
 */
export const TenantId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const user = context.switchToHttp().getRequest<PrincipalRequest>().user;
    return user?.tenantId as string;
  }
);
/**
 * Injects the active facility id, failing when there is none.
 *
 * Writes are facility-scoped: `facility_id` is `NOT NULL` on the clinical
 * tables. A caller who has not selected a facility has to be told so rather
 * than have a write attributed to a facility they never chose. Reads that are
 * legitimately tenant-wide keep using {@link FacilityId}, which yields `null`.
 *
 * The first accessible facility is used when none is explicitly active, so a
 * single-facility user does not have to send `X-Facility-Id` to be
 * unambiguous about which one they mean.
 */
export const ActiveFacilityId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const user = context.switchToHttp().getRequest<PrincipalRequest>().user;
    const facilityId = user?.activeFacilityId ?? user?.facilityIds[0];

    if (!facilityId) {
      throw new ForbiddenException(
        'This operation requires a facility scope. Select a facility you have access to, or send X-Facility-Id for one.'
      );
    }

    return facilityId;
  }
);

/**
 * Injects the active facility id, if the caller is scoped to one.
 */
export const FacilityId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null =>
    context.switchToHttp().getRequest<PrincipalRequest>().user?.activeFacilityId ?? null
);
