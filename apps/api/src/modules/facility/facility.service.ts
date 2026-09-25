import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService, type DatabaseContext } from '@hims/database';
import type { PaginatedResult } from '../../core/interfaces/paginated-result.js';
import type { CreateFacilityInput, UpdateFacilityInput } from './dto/facility.dto.js';

export interface FacilityRecord {
  id: string;
  tenantId: string;
  facilityCode: string;
  name: string;
  facilityType: string;
  hfrId: string | null;
  timezone: string;
  status: string;
  address: Record<string, unknown>;
  contact: Record<string, unknown>;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DepartmentRecord {
  id: string;
  tenantId: string;
  facilityId: string;
  departmentCode: string;
  name: string;
  departmentType: string;
  parentDepartmentId: string | null;
  clinicalServiceFlag: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface LocationRecord {
  id: string;
  facilityId: string;
  parentLocationId: string | null;
  locationType: string;
  code: string;
  name: string;
  isClinical: boolean;
  status: string;
}

const FACILITY_COLUMNS = `
  id,
  tenant_id      AS "tenantId",
  facility_code  AS "facilityCode",
  name,
  facility_type  AS "facilityType",
  hfr_id         AS "hfrId",
  timezone,
  status,
  address_jsonb  AS address,
  contact_jsonb  AS contact,
  settings_jsonb AS settings,
  created_at     AS "createdAt",
  updated_at     AS "updatedAt",
  version
`;

/**
 * Facility hierarchy: tenant → facility → department → location
 * (development.md §10.4). Facilities are the unit of physical operation; most
 * clinical rows carry a `facility_id` in addition to `tenant_id`.
 */
@Injectable()
export class FacilityService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * List facilities visible to the caller.
   *
   * Non-administrators are restricted to their explicit
   * `user_facility_access` grants, so this is also the endpoint the web app
   * uses to populate its facility switcher.
   */
  async list(
    ctx: DatabaseContext,
    options: { isTenantAdmin: boolean; facilityIds: string[]; limit: number; status?: string },
  ): Promise<PaginatedResult<FacilityRecord>> {
    const params: unknown[] = [ctx.tenantId];
    const filters = ['tenant_id = $1'];

    if (!options.isTenantAdmin) {
      if (options.facilityIds.length === 0) {
        return { items: [], hasMore: false, nextCursor: null };
      }
      params.push(options.facilityIds);
      filters.push(`id = ANY($${params.length}::uuid[])`);
    }

    if (options.status) {
      params.push(options.status);
      filters.push(`status = $${params.length}`);
    }

    params.push(options.limit + 1);

    const { rows } = await this.db.query<FacilityRecord>(
      `SELECT ${FACILITY_COLUMNS}
         FROM hims_core.facilities
        WHERE ${filters.join(' AND ')}
        ORDER BY name
        LIMIT $${params.length}`,
      params,
      ctx,
    );

    return this.toPage(rows, options.limit);
  }

  async getById(id: string, ctx: DatabaseContext): Promise<FacilityRecord> {
    const facility = await this.db.one<FacilityRecord>(
      `SELECT ${FACILITY_COLUMNS} FROM hims_core.facilities WHERE id = $1`,
      [id],
      ctx,
    );
    if (!facility) throw new NotFoundException('Facility not found');
    return facility;
  }

  async create(input: CreateFacilityInput, ctx: DatabaseContext): Promise<FacilityRecord> {
    const facility = await this.db
      .one<FacilityRecord>(
        `INSERT INTO hims_core.facilities (
           tenant_id, facility_code, name, facility_type, hfr_id, timezone,
           address_jsonb, contact_jsonb, settings_jsonb, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)
         RETURNING ${FACILITY_COLUMNS}`,
        [
          ctx.tenantId,
          input.facilityCode,
          input.name,
          input.facilityType,
          input.hfrId ?? null,
          input.timezone ?? 'Asia/Kolkata',
          JSON.stringify(input.address ?? {}),
          JSON.stringify(input.contact ?? {}),
          JSON.stringify(input.settings ?? {}),
          ctx.userId ?? null,
        ],
        ctx,
      )
      .catch((error: unknown) => {
        // 23505 = unique_violation on (tenant_id, facility_code)
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException(
            `Facility code "${input.facilityCode}" is already in use in this tenant`,
          );
        }
        throw error;
      });

    return facility as FacilityRecord;
  }

  async update(
    id: string,
    input: UpdateFacilityInput,
    ctx: DatabaseContext,
  ): Promise<FacilityRecord> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };

    if (input.name !== undefined) push('name', input.name);
    if (input.facilityType !== undefined) push('facility_type', input.facilityType);
    if (input.hfrId !== undefined) push('hfr_id', input.hfrId);
    if (input.timezone !== undefined) push('timezone', input.timezone);
    if (input.status !== undefined) push('status', input.status);
    if (input.address !== undefined) push('address_jsonb', JSON.stringify(input.address), '::jsonb');
    if (input.contact !== undefined) push('contact_jsonb', JSON.stringify(input.contact), '::jsonb');
    if (input.settings !== undefined) push('settings_jsonb', JSON.stringify(input.settings), '::jsonb');
    if (input.version !== undefined) push('version', input.version);

    if (sets.length === 0) return this.getById(id, ctx);

    sets.push('updated_at = now()');
    params.push(id);

    const facility = await this.db.one<FacilityRecord>(
      `UPDATE hims_core.facilities SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING ${FACILITY_COLUMNS}`,
      params,
      ctx,
    );

    if (!facility) throw new NotFoundException('Facility not found');
    return facility;
  }

  async listDepartments(
    facilityId: string,
    ctx: DatabaseContext,
    limit: number,
  ): Promise<PaginatedResult<DepartmentRecord>> {
    const { rows } = await this.db.query<DepartmentRecord>(
      `SELECT id, tenant_id AS "tenantId", facility_id AS "facilityId",
              department_code AS "departmentCode", name, department_type AS "departmentType",
              parent_department_id AS "parentDepartmentId",
              clinical_service_flag AS "clinicalServiceFlag", status,
              created_at AS "createdAt", updated_at AS "updatedAt", version
         FROM hims_core.departments
        WHERE facility_id = $1
        ORDER BY name
        LIMIT $2`,
      [facilityId, limit + 1],
      ctx,
    );
    return this.toPage(rows, limit);
  }

  async listLocations(
    facilityId: string,
    ctx: DatabaseContext,
    limit: number,
  ): Promise<PaginatedResult<LocationRecord>> {
    const { rows } = await this.db.query<LocationRecord>(
      `SELECT id, facility_id AS "facilityId", parent_location_id AS "parentLocationId",
              location_type AS "locationType", code, name,
              is_clinical AS "isClinical", status
         FROM hims_core.locations
        WHERE facility_id = $1
        ORDER BY code
        LIMIT $2`,
      [facilityId, limit + 1],
      ctx,
    );
    return this.toPage(rows, limit);
  }

  private toPage<T>(rows: T[], limit: number): PaginatedResult<T> {
    const hasMore = rows.length > limit;
    return {
      items: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
      nextCursor: null,
    };
  }
}
