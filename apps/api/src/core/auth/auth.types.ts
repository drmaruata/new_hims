/**
 * Authenticated principal and its resolved scope.
 *
 * The JWT only proves *who* the caller is. Everything about *what* they may do
 * is resolved server-side from `hims_core` membership tables, per
 * API_CONTRACT.md §3.3 and PERMISSION_MATRIX.md.
 */

export interface AuthenticatedUser {
  /** `auth.users.id` — the internal `user_id`. */
  userId: string;
  email: string | null;
  displayName: string | null;
  /** The tenant selected for this request. Never taken from a client header. */
  tenantId: string;
  tenantCode: string;
  /** Role codes granted by `hims_core.user_roles` for this tenant. */
  roles: string[];
  /** Effective permission codes, unioned across the user's active roles. */
  permissions: string[];
  /** Facilities the user may act within, from `hims_core.user_facility_access`. */
  facilityIds: string[];
  /** Departments the user may act within. Empty means tenant-wide. */
  departmentIds: string[];
  /** Facility currently in scope, if a specific one was selected. */
  activeFacilityId: string | null;
  isTenantAdmin: boolean;
  mfaVerified: boolean;
}

/**
 * Permissive shape of a permission string.
 * Canonical form is `DOMAIN:RESOURCE:ACTION:SCOPE` (SRS §8), but wildcards are
 * supported so a role can hold `PATIENT:*:READ:*`.
 */
export type PermissionPattern = string;

export function matchesPermission(
  granted: readonly string[],
  required: PermissionPattern,
): boolean {
  if (granted.length === 0) return false;
  if (granted.includes('*')) return true;

  const wanted = required.split(':');
  if (wanted.length > 4) return false;

  return granted.some((pattern) => {
    const have = pattern.split(':');
    if (have.length > 4) return false;

    // Every explicit segment of the requirement must be matched positionally.
    for (let i = 0; i < wanted.length; i++) {
      const expected = wanted[i];
      if (expected === '*') continue;
      if (have[i] === '*' || have[i] === expected) continue;
      return false;
    }
    return true;
  });
}
