import { createClient } from '@supabase/supabase-js';
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
    return permissionCodes.some((code) => this.hasPermission(context, code));
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

/**
 * Browser Supabase Auth client factory.
 *
 * The browser receives only the public/anonymous key. The server-only service
 * key is deliberately not represented by this API. Supabase persists and
 * refreshes the session in browser storage; the HIMS API then receives the
 * resulting bearer access token and performs its own membership/permission
 * resolution.
 */
export function createSupabaseBrowserClient(supabaseUrl: string, anonKey: string) {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase browser client requires SUPABASE URL and anonymous/public key');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}
