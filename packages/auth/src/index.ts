import type { UUID } from '@hims/domain-types';

export interface UserAuthContext {
  userId: UUID;
  tenantId: UUID;
  facilityId: UUID;
  departmentId?: UUID | null;
  roles: string[];
  permissions: string[];
  isTenantAdmin?: boolean;
}

export class PolicyEngine {
  public static hasPermission(context: UserAuthContext, permissionCode: string): boolean {
    if (context.isTenantAdmin) return true;
    return context.permissions.includes(permissionCode) || context.permissions.includes('*');
  }

  public static hasAnyPermission(context: UserAuthContext, permissionCodes: string[]): boolean {
    if (context.isTenantAdmin) return true;
    return permissionCodes.some(code => this.hasPermission(context, code));
  }

  public static hasRole(context: UserAuthContext, roleCode: string): boolean {
    if (context.isTenantAdmin) return true;
    return context.roles.includes(roleCode);
  }

  public static validateFacilityAccess(context: UserAuthContext, targetFacilityId: UUID): boolean {
    if (context.isTenantAdmin) return true;
    return context.facilityId === targetFacilityId;
  }
}
