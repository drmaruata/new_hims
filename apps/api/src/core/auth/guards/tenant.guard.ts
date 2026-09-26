import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth.types.js';

/**
 * Second line of defence for tenant isolation.
 *
 * `JwtAuthGuard` has already resolved a membership-backed tenant, so this
 * mainly guarantees a principal exists for any route that declares it. The
 * actual hard guarantee is PostgreSQL RLS keyed on `app.tenant_id`.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    if (!request.user?.tenantId) {
      throw new ForbiddenException('No tenant scope could be resolved for this request');
    }

    return true;
  }
}
