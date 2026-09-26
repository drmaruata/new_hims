import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '@hims/database';
import { TokenService, type SupabaseJwtClaims } from './token.service.js';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * A tenant this user belongs to, as returned by `listMemberships`.
 *
 * Exported because `AuthController` returns it from a public method: with
 * `declaration: true` the emitted `.d.ts` must be able to name the type, and a
 * non-exported interface is not referenceable from another module.
 */
export interface MembershipRow {
  tenant_id: string;
  tenant_code: string;
  membership_status: string;
  is_tenant_admin: boolean;
}

interface RoleRow {
  role_code: string;
}

interface PermissionRow {
  permission_code: string;
}

interface FacilityRow {
  facility_id: string;
}

interface DepartmentRow {
  department_id: string;
}

interface ProfileRow {
  display_name: string | null;
  email: string | null;
}

/**
 * Turns a verified Supabase access token into an `AuthenticatedUser`.
 *
 * Tenant scope comes from `hims_core.tenant_memberships` — never from a
 * request header or a client-supplied body field (API_CONTRACT §3.3). When a
 * caller asks for a specific tenant, it must be one they are an active member
 * of, otherwise the request is rejected.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  async resolve(
    claims: SupabaseJwtClaims,
    requestedTenantId?: string,
    requestedFacilityId?: string
  ): Promise<AuthenticatedUser> {
    const userId = claims.sub;
    if (!userId) {
      throw new UnauthorizedException('Access token has no subject');
    }

    const memberships = await this.loadMemberships(userId);

    if (memberships.length === 0) {
      throw new ForbiddenException('This account is not a member of any HIMS tenant');
    }

    const membership = requestedTenantId
      ? memberships.find((m) => m.tenant_id === requestedTenantId)
      : memberships[0];

    if (!membership) {
      // Deliberately indistinguishable from "not found" so this cannot be used
      // to probe which tenant IDs exist (API_CONTRACT §6).
      throw new UnauthorizedException('No access to the requested tenant');
    }

    if (membership.membership_status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant membership is not active');
    }

    const tenantId = membership.tenant_id;
    // Reading our own authorization rows must not be blocked by RLS, so each
    // loader below runs with an explicit `{ tenantId, userId }` context rather
    // than relying on an ambient one.

    const [roles, permissions, facilities, departments, profile] = await Promise.all([
      this.loadRoles(userId, tenantId),
      this.loadPermissions(userId, tenantId),
      this.loadFacilities(userId, tenantId),
      this.loadDepartments(userId, tenantId),
      this.loadProfile(userId, tenantId),
    ]);

    const facilityIds = facilities.map((f) => f.facility_id);

    if (requestedFacilityId && !facilityIds.includes(requestedFacilityId)) {
      throw new ForbiddenException('No access to the requested facility');
    }

    if (facilityIds.length === 0 && !membership.is_tenant_admin) {
      this.logger.debug(`User ${userId} has no explicit facility grants in tenant ${tenantId}`);
    }

    return {
      userId,
      email: profile?.email ?? claims.email ?? null,
      displayName: profile?.display_name ?? null,
      tenantId,
      tenantCode: membership.tenant_code,
      roles,
      permissions,
      facilityIds,
      departmentIds: departments.map((d) => d.department_id),
      activeFacilityId: requestedFacilityId ?? facilityIds[0] ?? null,
      isTenantAdmin: membership.is_tenant_admin,
      mfaVerified: TokenService.hasMfa(claims),
    };
  }

  /**
   * Tenants the caller belongs to, for the tenant switcher in the web app.
   */
  async listMemberships(userId: string) {
    return this.loadMemberships(userId);
  }

  private async loadMemberships(userId: string): Promise<MembershipRow[]> {
    // The only query in the codebase that runs before a tenant is known: it is
    // what *establishes* the tenant. Tenant-keyed RLS would make that circular,
    // so this uses `queryForUser`, which sets `app.user_id` and lets the
    // `tenant_memberships_self_select` policy return this user's own rows across
    // every hospital they belong to. `hims_core.tenants` carries no `tenant_id`
    // (it *is* the tenant), so joining it for `code` is unguarded by design.
    const { rows } = await this.db.queryForUser<MembershipRow>(
      `SELECT m.tenant_id,
              t.code AS tenant_code,
              m.membership_status,
              m.is_tenant_admin
         FROM hims_core.tenant_memberships m
         JOIN hims_core.tenants t ON t.id = m.tenant_id
        WHERE m.user_id = $1
          AND m.membership_status = 'ACTIVE'
          AND t.status = 'ACTIVE'
        ORDER BY m.tenant_id`,
      [userId],
      userId
    );
    return rows;
  }

  private async loadRoles(userId: string, tenantId: string): Promise<string[]> {
    const { rows } = await this.db.query<RoleRow>(
      `SELECT DISTINCT r.code AS role_code
         FROM hims_core.user_roles ur
         JOIN hims_core.roles r ON r.id = ur.role_id
        WHERE ur.tenant_id = $1
          AND ur.user_id = $2
          AND ur.status = 'ACTIVE'
          AND r.status = 'ACTIVE'
          AND (ur.active_from IS NULL OR ur.active_from <= now())
          AND (ur.active_to IS NULL OR ur.active_to > now())
        ORDER BY r.code`,
      [tenantId, userId],
      { tenantId, userId }
    );
    return rows.map((r) => r.role_code);
  }

  private async loadPermissions(userId: string, tenantId: string): Promise<string[]> {
    const { rows } = await this.db.query<PermissionRow>(
      `SELECT DISTINCT rp.permission_code
         FROM hims_core.user_roles ur
         JOIN hims_core.role_permissions rp
           ON rp.tenant_id = ur.tenant_id
          AND rp.role_id = ur.role_id
        WHERE ur.tenant_id = $1
          AND ur.user_id = $2
          AND ur.status = 'ACTIVE'
          AND (ur.active_from IS NULL OR ur.active_from <= now())
          AND (ur.active_to IS NULL OR ur.active_to > now())
        ORDER BY rp.permission_code`,
      [tenantId, userId],
      { tenantId, userId }
    );
    return rows.map((p) => p.permission_code);
  }

  private async loadFacilities(userId: string, tenantId: string): Promise<FacilityRow[]> {
    const { rows } = await this.db.query<FacilityRow>(
      `SELECT facility_id
         FROM hims_core.user_facility_access
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY facility_id`,
      [tenantId, userId],
      { tenantId, userId }
    );
    return rows;
  }

  private async loadDepartments(userId: string, tenantId: string): Promise<DepartmentRow[]> {
    const { rows } = await this.db.query<DepartmentRow>(
      `SELECT department_id
         FROM hims_core.user_department_access
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY department_id`,
      [tenantId, userId],
      { tenantId, userId }
    );
    return rows;
  }

  private async loadProfile(userId: string, tenantId: string): Promise<ProfileRow | null> {
    return this.db.one<ProfileRow>(
      `SELECT display_name, email
         FROM hims_core.user_profiles
        WHERE tenant_id = $1 AND user_id = $2
        LIMIT 1`,
      [tenantId, userId],
      { tenantId, userId }
    );
  }

  /**
   * Development-only escape hatch so the web app can be driven before Supabase
   * is running. Refuses to activate in production (API_CONTRACT §3.3).
   */
  devFallbackUser(): AuthenticatedUser | null {
    if (this.configService.get<string>('NODE_ENV') === 'production') return null;
    if (!this.configService.get<string>('AUTH_DEV_FALLBACK')) return null;

    return {
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'dev.user@hims.local',
      displayName: 'Development User',
      tenantId: '11111111-1111-4111-8111-111111111111',
      tenantCode: 'HIMS-DEV',
      roles: ['TENANT_ADMIN'],
      permissions: ['*'],
      facilityIds: ['22222222-2222-4222-8222-222222222221'],
      departmentIds: [],
      activeFacilityId: '22222222-2222-4222-8222-222222222221',
      isTenantAdmin: true,
      mfaVerified: false,
    };
  }
}
