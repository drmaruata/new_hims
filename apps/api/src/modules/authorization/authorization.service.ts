import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService, type DatabaseContext } from '@hims/database';
import type { PaginatedResult } from '../../core/interfaces/paginated-result.js';
import type {
  AssignRoleInput,
  CreateRoleInput,
  SetPermissionsInput,
  UpsertFacilityAccessInput,
} from './dto/authorization.dto.js';

export interface UserSummary {
  userId: string;
  displayName: string | null;
  email: string | null;
  mobile: string | null;
  employeeCode: string | null;
  professionalCategory: string | null;
  status: string;
  membershipStatus: string;
  isTenantAdmin: boolean;
  roles: string[];
  facilityIds: string[];
  lastLoginAt: string | null;
}

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  systemRole: boolean;
  status: string;
  permissionCount: number;
}

export interface PermissionSummary {
  code: string;
  description: string;
  riskLevel: string;
}

/**
 * User, role and permission administration.
 *
 * Identity itself lives in Supabase Auth (`auth.users`); this module manages
 * only the *authorization* surface: membership, roles, permissions and
 * facility/department grants. Passwords and credentials are never handled
 * here (API_CONTRACT §3).
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * List the caller's tenant's users.
   *
   * `hims_core.user_profiles` is the authoritative display record; a user can
   * hold a membership without a profile yet, so the profile join is a LEFT JOIN
   * and membership is the driver.
   */
  async listUsers(
    ctx: DatabaseContext,
    options: { limit: number; search?: string; status?: string },
  ): Promise<PaginatedResult<UserSummary>> {
    const params: unknown[] = [ctx.tenantId];
    const filters = ['m.tenant_id = $1'];

    if (options.status) {
      params.push(options.status);
      filters.push(`m.membership_status = $${params.length}`);
    }

    if (options.search?.trim()) {
      params.push(`%${options.search.trim()}%`);
      const p = params.length;
      filters.push(
        `(p.display_name ILIKE $${p}
          OR p.email ILIKE $${p}
          OR p.mobile ILIKE $${p}
          OR p.employee_code ILIKE $${p})`,
      );
    }

    params.push(options.limit + 1);

    const { rows } = await this.db.query<UserSummary>(
      `SELECT m.user_id                            AS "userId",
              p.display_name                       AS "displayName",
              p.email                              AS "email",
              p.mobile                             AS "mobile",
              p.employee_code                      AS "employeeCode",
              p.professional_category              AS "professionalCategory",
              COALESCE(p.status, 'ACTIVE')         AS status,
              m.membership_status                  AS "membershipStatus",
              m.is_tenant_admin                    AS "isTenantAdmin",
              COALESCE(
                (SELECT array_agg(r.code ORDER BY r.code)
                   FROM hims_core.user_roles ur
                   JOIN hims_core.roles r ON r.id = ur.role_id
                  WHERE ur.tenant_id = m.tenant_id
                    AND ur.user_id = m.user_id
                    AND ur.status = 'ACTIVE'),
                ARRAY[]::text[]
              )                                    AS roles,
              COALESCE(
                (SELECT array_agg(fa.facility_id ORDER BY fa.facility_id)
                   FROM hims_core.user_facility_access fa
                  WHERE fa.tenant_id = m.tenant_id AND fa.user_id = m.user_id),
                ARRAY[]::uuid[]
              )                                    AS "facilityIds",
              p.last_login_at                      AS "lastLoginAt"
         FROM hims_core.tenant_memberships m
         LEFT JOIN hims_core.user_profiles p
           ON p.tenant_id = m.tenant_id AND p.user_id = m.user_id
        WHERE ${filters.join(' AND ')}
        ORDER BY COALESCE(p.display_name, m.user_id::text)
        LIMIT $${params.length}`,
      params,
      ctx,
    );

    const hasMore = rows.length > options.limit;
    return {
      items: hasMore ? rows.slice(0, options.limit) : rows,
      hasMore,
      nextCursor: null,
    };
  }

  async getUser(userId: string, ctx: DatabaseContext): Promise<UserSummary> {
    const { rows } = await this.db.query<UserSummary>(
      `SELECT m.user_id                            AS "userId",
              p.display_name                       AS "displayName",
              p.email                              AS "email",
              p.mobile                             AS "mobile",
              p.employee_code                      AS "employeeCode",
              p.professional_category              AS "professionalCategory",
              COALESCE(p.status, 'ACTIVE')         AS status,
              m.membership_status                  AS "membershipStatus",
              m.is_tenant_admin                    AS "isTenantAdmin",
              COALESCE(
                (SELECT array_agg(r.code ORDER BY r.code)
                   FROM hims_core.user_roles ur
                   JOIN hims_core.roles r ON r.id = ur.role_id
                  WHERE ur.tenant_id = m.tenant_id
                    AND ur.user_id = m.user_id
                    AND ur.status = 'ACTIVE'),
                ARRAY[]::text[]
              )                                    AS roles,
              COALESCE(
                (SELECT array_agg(fa.facility_id ORDER BY fa.facility_id)
                   FROM hims_core.user_facility_access fa
                  WHERE fa.tenant_id = m.tenant_id AND fa.user_id = m.user_id),
                ARRAY[]::uuid[]
              )                                    AS "facilityIds",
              p.last_login_at                      AS "lastLoginAt"
         FROM hims_core.tenant_memberships m
         LEFT JOIN hims_core.user_profiles p
           ON p.tenant_id = m.tenant_id AND p.user_id = m.user_id
        WHERE m.tenant_id = $1 AND m.user_id = $2`,
      [ctx.tenantId, userId],
      ctx,
    );

    if (rows.length === 0) throw new NotFoundException('User not found');
    return rows[0];
  }

  /**
   * Change membership status.
   *
   * Deactivation is a status change rather than a delete: the user's clinical
   * authorship and audit history must remain attributable forever, so the
   * `auth.users` row and every `created_by` reference are retained.
   */
  async setMembershipStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
    ctx: DatabaseContext,
  ): Promise<UserSummary> {
    const { rowCount } = await this.db.query(
      `UPDATE hims_core.tenant_memberships
          SET membership_status = $1
        WHERE tenant_id = $2 AND user_id = $3`,
      [status, ctx.tenantId, userId],
      ctx,
    );

    if (rowCount === 0) throw new NotFoundException('User is not a member of this tenant');

    // Deactivating a member must also end their role assignments and facility
    // grants in the same transaction, or a suspended user would keep whatever
    // access their roles imply.
    if (status !== 'ACTIVE') {
      await this.db.query(
        `UPDATE hims_core.user_roles
            SET status = 'INACTIVE', active_to = now()
          WHERE tenant_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
        [ctx.tenantId, userId],
        ctx,
      );
      await this.db.query(
        `DELETE FROM hims_core.user_facility_access
          WHERE tenant_id = $1 AND user_id = $2`,
        [ctx.tenantId, userId],
        ctx,
      );
      await this.db.query(
        `DELETE FROM hims_core.user_department_access
          WHERE tenant_id = $1 AND user_id = $2`,
        [ctx.tenantId, userId],
        ctx,
      );
    }

    return this.getUser(userId, ctx);
  }

  async listRoles(
    ctx: DatabaseContext,
    limit: number,
  ): Promise<PaginatedResult<RoleSummary>> {
    const { rows } = await this.db.query<RoleSummary>(
      `SELECT r.id,
              r.code,
              r.name,
              r.description,
              r.system_role AS "systemRole",
              r.status,
              (SELECT count(*)::int
                 FROM hims_core.role_permissions rp
                WHERE rp.role_id = r.id) AS "permissionCount"
         FROM hims_core.roles r
        WHERE r.tenant_id = $1
        ORDER BY r.code
        LIMIT $2`,
      [ctx.tenantId, limit + 1],
      ctx,
    );

    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, limit) : rows, hasMore, nextCursor: null };
  }

  async createRole(input: CreateRoleInput, ctx: DatabaseContext): Promise<RoleSummary> {
    const role = await this.db
      .one<RoleSummary>(
        `INSERT INTO hims_core.roles (tenant_id, code, name, description, system_role)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, code, name, description,
                   system_role AS "systemRole", status, 0 AS "permissionCount"`,
        [ctx.tenantId, input.code, input.name, input.description ?? null],
        ctx,
      )
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException(`Role code "${input.code}" already exists`);
        }
        throw error;
      });

    return role as RoleSummary;
  }

  async updateRole(
    roleId: string,
    patch: { name?: string; description?: string | null; status?: 'ACTIVE' | 'INACTIVE' },
    ctx: DatabaseContext,
  ): Promise<RoleSummary> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (patch.name !== undefined) push('name', patch.name);
    if (patch.description !== undefined) push('description', patch.description);
    if (patch.status !== undefined) push('status', patch.status);

    if (sets.length === 0) {
      throw new BadRequestException('At least one field must be supplied');
    }

    params.push(ctx.tenantId, roleId);
    const role = await this.db.one<RoleSummary>(
      `UPDATE hims_core.roles SET ${sets.join(', ')}
        WHERE tenant_id = $${params.length - 1} AND id = $${params.length}
        RETURNING id, code, name, description, system_role AS "systemRole", status, 0 AS "permissionCount"`,
      params,
      ctx,
    );

    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  /** Replace a role's permission set wholesale. */
  async setRolePermissions(
    roleId: string,
    input: SetPermissionsInput,
    ctx: DatabaseContext,
  ): Promise<{ roleId: string; permissions: string[] }> {
    return this.db.transaction(async (client) => {
      const existing = await client.query<{ system_role: boolean }>(
        `SELECT system_role FROM hims_core.roles
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [roleId, ctx.tenantId],
      );

      if (existing.rows.length === 0) throw new NotFoundException('Role not found');
      if (existing.rows[0].system_role) {
        // A system role defines the meaning of every permission string, so its
        // grant set must not be edited per-tenant.
        throw new ConflictException(
          'System role permissions cannot be modified; fork the role instead',
        );
      }

      await client.query(
        `DELETE FROM hims_core.role_permissions
          WHERE tenant_id = $1 AND role_id = $2`,
        [ctx.tenantId, roleId],
      );

      if (input.permissionCodes.length > 0) {
        await client.query(
          `INSERT INTO hims_core.role_permissions (tenant_id, role_id, permission_code)
           SELECT $1, $2, unnest($3::text[])`,
          [ctx.tenantId, roleId, input.permissionCodes],
        );
      }

      return { roleId, permissions: input.permissionCodes };
    }, ctx);
  }

  async listPermissions(
    limit: number,
    ctx: DatabaseContext,
  ): Promise<PaginatedResult<PermissionSummary>> {
    // `hims_core.permissions` is global reference data with no `tenant_id`
    // column, so the baseline enables no RLS policy on it. `ctx` is still
    // required because every query runs through a transaction that establishes
    // the tenant context first.
    const { rows } = await this.db.query<PermissionSummary>(
      `SELECT code, description, risk_level AS "riskLevel"
         FROM hims_core.permissions
        ORDER BY code
        LIMIT $1`,
      [limit + 1],
      ctx,
    );

    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, limit) : rows, hasMore, nextCursor: null };
  }

  async assignRole(input: AssignRoleInput, ctx: DatabaseContext): Promise<UserSummary> {
    try {
      await this.db.query(
        `INSERT INTO hims_core.user_roles
           (tenant_id, user_id, role_id, facility_id, department_id, active_from, status)
         VALUES ($1, $2, $3, $4, $5, now(), 'ACTIVE')`,
        [
          ctx.tenantId,
          input.userId,
          input.roleId,
          input.facilityId ?? null,
          input.departmentId ?? null,
        ],
        ctx,
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'That role is already assigned at this exact facility/department scope',
        );
      }
      if ((error as { code?: string }).code === '23503') {
        throw new NotFoundException('User, role, facility or department not found');
      }
      throw error;
    }

    return this.getUser(input.userId, ctx);
  }

  async revokeRole(
    userId: string,
    roleId: string,
    ctx: DatabaseContext,
  ): Promise<UserSummary> {
    const { rowCount } = await this.db.query(
      `UPDATE hims_core.user_roles
          SET status = 'INACTIVE', active_to = now()
        WHERE tenant_id = $1 AND user_id = $2 AND role_id = $3 AND status = 'ACTIVE'`,
      [ctx.tenantId, userId, roleId],
      ctx,
    );

    if (rowCount === 0) throw new NotFoundException('Active role assignment not found');
    return this.getUser(userId, ctx);
  }

  /** Replace a user's facility grants with exactly the supplied set. */
  async setFacilityAccess(
    userId: string,
    input: UpsertFacilityAccessInput,
    ctx: DatabaseContext,
  ): Promise<UserSummary> {
    await this.db.transaction(async (client) => {
      await client.query(
        `DELETE FROM hims_core.user_facility_access
          WHERE tenant_id = $1 AND user_id = $2`,
        [ctx.tenantId, userId],
      );

      if (input.facilityIds.length > 0) {
        await client.query(
          `INSERT INTO hims_core.user_facility_access (tenant_id, user_id, facility_id)
           SELECT $1, $2, unnest($3::uuid[])`,
          [ctx.tenantId, userId, input.facilityIds],
        );
      }
    }, ctx);

    return this.getUser(userId, ctx);
  }

  async setDepartmentAccess(
    userId: string,
    departmentIds: string[],
    ctx: DatabaseContext,
  ): Promise<UserSummary> {
    await this.db.transaction(async (client) => {
      await client.query(
        `DELETE FROM hims_core.user_department_access
          WHERE tenant_id = $1 AND user_id = $2`,
        [ctx.tenantId, userId],
      );

      if (departmentIds.length > 0) {
        await client.query(
          `INSERT INTO hims_core.user_department_access (tenant_id, user_id, department_id)
           SELECT $1, $2, unnest($3::uuid[])`,
          [ctx.tenantId, userId, departmentIds],
        );
      }
    }, ctx);

    return this.getUser(userId, ctx);
  }
}
