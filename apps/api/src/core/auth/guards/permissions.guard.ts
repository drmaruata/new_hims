import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import {
  matchesPermission,
  type AuthenticatedUser,
  type PermissionPattern,
} from '../auth.types.js';

/**
 * Enforces `DOMAIN:RESOURCE:ACTION:SCOPE` permissions declared with
 * `@RequirePermissions(...)`. All listed permissions must be held.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionPattern[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated principal for this route');
    }

    // A tenant administrator implicitly holds everything within their tenant.
    if (user.isTenantAdmin) return true;

    const missing = required.filter(
      (permission) => !matchesPermission(user.permissions, permission)
    );

    if (missing.length > 0) {
      throw new ForbiddenException(`Missing required permission: ${missing.join(', ')}`);
    }

    return true;
  }
}
