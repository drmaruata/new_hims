import { SetMetadata } from '@nestjs/common';

import type { PermissionPattern } from '../auth.types.js';

export const PERMISSIONS_KEY = 'hims:permissions';

/**
 * Declares the permissions a route requires, in `DOMAIN:RESOURCE:ACTION:SCOPE`
 * form (SRS §8). Enforced by `PermissionsGuard`.
 *
 * @example `@RequirePermissions('PATIENT:DEMOGRAPHICS:READ:TENANT')`
 */
export const RequirePermissions = (...permissions: PermissionPattern[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
