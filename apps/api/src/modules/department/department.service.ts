import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService, type DatabaseContext } from '@hims/database';
import type { PaginatedResult } from '../../core/interfaces/paginated-result.js';
import type { CreateDepartmentInput, UpdateDepartmentInput } from './dto/department.dto.js';
import type { DepartmentRecord } from '../facility/facility.service.js';

const DEPARTMENT_COLUMNS = `
  id,
  tenant_id              AS "tenantId",
  facility_id            AS "facilityId",
  department_code        AS "departmentCode",
  name,
  department_type        AS "departmentType",
  parent_department_id   AS "parentDepartmentId",
  clinical_service_flag  AS "clinicalServiceFlag",
  status,
  created_at             AS "createdAt",
  updated_at             AS "updatedAt",
  version
`;

/**
 * Departments sit between facility and clinical service line. OPD, LIS, RIS,
 * OT, ICU and pharmacy all scope their work to a department, so a department
 * code is a first-class authorization input rather than a label.
 */
@Injectable()
export class DepartmentService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    ctx: DatabaseContext,
    options: { facilityId?: string; limit: number; status?: string }
  ): Promise<PaginatedResult<DepartmentRecord>> {
    const params: unknown[] = [ctx.tenantId];
    const filters = ['tenant_id = $1'];

    if (options.facilityId) {
      params.push(options.facilityId);
      filters.push(`facility_id = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      filters.push(`status = $${params.length}`);
    }

    params.push(options.limit + 1);

    const { rows } = await this.db.query<DepartmentRecord>(
      `SELECT ${DEPARTMENT_COLUMNS}
         FROM hims_core.departments
        WHERE ${filters.join(' AND ')}
        ORDER BY name
        LIMIT $${params.length}`,
      params,
      ctx
    );

    const hasMore = rows.length > options.limit;
    return {
      items: hasMore ? rows.slice(0, options.limit) : rows,
      hasMore,
      nextCursor: null,
    };
  }

  async getById(id: string, ctx: DatabaseContext): Promise<DepartmentRecord> {
    const department = await this.db.one<DepartmentRecord>(
      `SELECT ${DEPARTMENT_COLUMNS} FROM hims_core.departments WHERE id = $1`,
      [id],
      ctx
    );
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(input: CreateDepartmentInput, ctx: DatabaseContext): Promise<DepartmentRecord> {
    const department = await this.db
      .one<DepartmentRecord>(
        `INSERT INTO hims_core.departments (
           tenant_id, facility_id, department_code, name, department_type,
           parent_department_id, clinical_service_flag, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${DEPARTMENT_COLUMNS}`,
        [
          ctx.tenantId,
          input.facilityId,
          input.departmentCode,
          input.name,
          input.departmentType,
          input.parentDepartmentId ?? null,
          input.clinicalServiceFlag,
          ctx.userId ?? null,
        ],
        ctx
      )
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException(
            `Department code "${input.departmentCode}" already exists in this facility`
          );
        }
        if ((error as { code?: string }).code === '23503') {
          throw new NotFoundException('Facility or parent department not found');
        }
        throw error;
      });

    return department as DepartmentRecord;
  }

  async update(
    id: string,
    input: UpdateDepartmentInput,
    ctx: DatabaseContext
  ): Promise<DepartmentRecord> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (input.name !== undefined) push('name', input.name);
    if (input.departmentType !== undefined) push('department_type', input.departmentType);
    if (input.parentDepartmentId !== undefined) {
      if (input.parentDepartmentId === id) {
        throw new ConflictException('A department cannot be its own parent');
      }
      push('parent_department_id', input.parentDepartmentId);
    }
    if (input.clinicalServiceFlag !== undefined) {
      push('clinical_service_flag', input.clinicalServiceFlag);
    }
    if (input.status !== undefined) push('status', input.status);
    if (input.version !== undefined) push('version', input.version);

    if (sets.length === 0) return this.getById(id, ctx);

    sets.push('updated_at = now()');
    params.push(id);

    const department = await this.db.one<DepartmentRecord>(
      `UPDATE hims_core.departments SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING ${DEPARTMENT_COLUMNS}`,
      params,
      ctx
    );

    if (!department) throw new NotFoundException('Department not found');
    return department;
  }
}
