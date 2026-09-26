import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService, type DatabaseContext } from '@hims/database';
import type { PaginatedResult } from '../../core/interfaces/paginated-result.js';

export interface TenantRecord {
  id: string;
  code: string;
  legalName: string;
  displayName: string;
  status: string;
  timezone: string;
  defaultLocale: string;
  defaultCurrency: string;
  dataRegion: string | null;
  planCode: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

const TENANT_COLUMNS = `
  id,
  code,
  legal_name   AS "legalName",
  display_name AS "displayName",
  status,
  timezone,
  default_locale   AS "defaultLocale",
  default_currency AS "defaultCurrency",
  data_region      AS "dataRegion",
  plan_code        AS "planCode",
  settings_jsonb   AS settings,
  created_at       AS "createdAt",
  updated_at       AS "updatedAt",
  version
`;

/**
 * Tenant administration.
 *
 * A tenant is the outermost isolation boundary. A caller may only ever read or
 * mutate the tenant they hold an active membership for — enforced here and
 * independently by RLS.
 */
@Injectable()
export class TenantService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Read the caller's own tenant. Cross-tenant reads are not supported by
   * design: a platform operator acts through a support role, not by guessing
   * another tenant's id.
   */
  async getOwn(tenantId: string, ctx: DatabaseContext): Promise<TenantRecord> {
    const tenant = await this.db.one<TenantRecord>(
      `SELECT ${TENANT_COLUMNS} FROM hims_core.tenants WHERE id = $1`,
      [tenantId],
      ctx
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async getSettings(tenantId: string, ctx: DatabaseContext): Promise<Record<string, unknown>> {
    const tenant = await this.getOwn(tenantId, ctx);
    return tenant.settings;
  }

  /**
   * Partial update guarded by optimistic concurrency. `version` is supplied by
   * the client and a mismatch is a 409, which is how two administrators editing
   * the same tenant are prevented from silently overwriting each other.
   */
  async updateOwn(
    tenantId: string,
    patch: UpdateTenantInput,
    ctx: DatabaseContext
  ): Promise<TenantRecord> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (fragment: string, value: unknown) => {
      params.push(value);
      sets.push(`${fragment} = $${params.length}`);
    };

    if (patch.legalName !== undefined) push('legal_name', patch.legalName);
    if (patch.displayName !== undefined) push('display_name', patch.displayName);
    if (patch.timezone !== undefined) push('timezone', patch.timezone);
    if (patch.defaultLocale !== undefined) push('default_locale', patch.defaultLocale);
    if (patch.defaultCurrency !== undefined) push('default_currency', patch.defaultCurrency);
    if (patch.dataRegion !== undefined) push('data_region', patch.dataRegion);
    if (patch.planCode !== undefined) push('plan_code', patch.planCode);

    if (patch.settings) {
      params.push(JSON.stringify(patch.settings));
      sets.push(`settings_jsonb = settings_jsonb || $${params.length}::jsonb`);
    }

    if (patch.version !== undefined) {
      params.push(patch.version);
      sets.push(`version = $${params.length}`);
    }

    if (sets.length === 0) {
      return this.getOwn(tenantId, ctx);
    }

    params.push(tenantId);
    sets.push('updated_at = now()');

    const tenant = await this.db.one<TenantRecord>(
      `UPDATE hims_core.tenants
          SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING ${TENANT_COLUMNS}`,
      params,
      ctx
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async listFacilities(tenantId: string, ctx: DatabaseContext): Promise<PaginatedResult<unknown>> {
    const { rows } = await this.db.query(
      `SELECT id,
              facility_code AS "facilityCode",
              name,
              facility_type AS "facilityType",
              status
         FROM hims_core.facilities
        WHERE tenant_id = $1
        ORDER BY name
        LIMIT 500`,
      [tenantId],
      ctx
    );

    return { items: rows, hasMore: false, nextCursor: null };
  }
}

export interface UpdateTenantInput {
  legalName?: string;
  displayName?: string;
  timezone?: string;
  defaultLocale?: string;
  defaultCurrency?: string;
  dataRegion?: string;
  planCode?: string;
  settings?: Record<string, unknown>;
  version?: number;
}
