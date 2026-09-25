import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth.types.js';

/**
 * Requires that the caller is scoped to a specific facility.
 *
 * The facility comes from the resolved principal, not from a client header:
 * `JwtAuthGuard` already validated it against `hims_core.user_facility_access`.
 * Tenant administrators are allowed through so they can act across facilities.
 */
@Injectable()
export class FacilityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated principal for this route');
    }

    if (user.isTenantAdmin) return true;

    if (!user.activeFacilityId) {
      throw new ForbiddenException(
        'This operation requires an active facility scope. Send X-Facility-Id for a facility you have access to.',
      );
    }

    return true;
  }
}

