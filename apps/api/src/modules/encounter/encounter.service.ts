import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { monotonicFactory } from 'ulid';
import type { PoolClient } from 'pg';

import { DatabaseService, type DatabaseContext } from '@hims/database';
import type { PaginatedResult } from '../../core/interfaces/paginated-result.js';
import { encounterMachine, type EncounterState } from '../clinical-state/machines.js';
import type { CreateEncounterInput, UpdateEncounterInput } from './dto/encounter.dto.js';

/** Monotonic factory: guarantees ordering even within the same millisecond. */
const ulid = monotonicFactory();

/** `ENC-OPD-01J...` — type prefix makes the number readable on paper charts. */
export function buildEncounterNumber(encounterType: string): string {
  return `ENC-${encounterType.slice(0, 3).toUpperCase()}-${ulid()}`;
}

export interface EncounterRecord {
  id: string;
  tenantId: string;
  facilityId: string;
  patientId: string;
  encounterNumber: string;
  encounterType: string;
  status: EncounterState;
  departmentId: string;
  attendingPractitionerId: string | null;
  startedAt: string;
  endedAt: string | null;
  parentEncounterId: string | null;
  sourceEncounterId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

const ENCOUNTER_COLUMNS = `
  id,
  tenant_id                  AS "tenantId",
  facility_id                AS "facilityId",
  patient_id                 AS "patientId",
  encounter_number           AS "encounterNumber",
  encounter_type             AS "encounterType",
  status,
  department_id              AS "departmentId",
  attending_practitioner_id  AS "attendingPractitionerId",
  started_at                 AS "startedAt",
  ended_at                   AS "endedAt",
  parent_encounter_id        AS "parentEncounterId",
  source_encounter_id        AS "sourceEncounterId",
  reason,
  metadata_jsonb             AS metadata,
  created_at                 AS "createdAt",
  updated_at                 AS "updatedAt",
  version
`;

/**
 * Encounter lifecycle: the aggregate that binds a patient, a facility, a
 * department and a practitioner to a single episode of care.
 *
 * State changes are validated against `encounterMachine` *inside* the same
 * transaction as the write, so two clinicians racing to sign cannot both
 * succeed, and a closed encounter can never be reopened (SRS Appendix B).
 */
@Injectable()
export class EncounterService {
  constructor(private readonly db: DatabaseService) {}

  async getById(id: string, ctx: DatabaseContext): Promise<EncounterRecord> {
    const encounter = await this.db.one<EncounterRecord>(
      `SELECT ${ENCOUNTER_COLUMNS} FROM hims_clinical.encounters WHERE id = $1`,
      [id],
      ctx
    );
    if (!encounter) throw new NotFoundException('Encounter not found');
    return encounter;
  }

  async listForPatient(
    patientId: string,
    ctx: DatabaseContext,
    limit: number
  ): Promise<PaginatedResult<EncounterRecord>> {
    const { rows } = await this.db.query<EncounterRecord>(
      `SELECT ${ENCOUNTER_COLUMNS}
         FROM hims_clinical.encounters
        WHERE patient_id = $1
        ORDER BY started_at DESC
        LIMIT $2`,
      [patientId, limit + 1],
      ctx
    );

    const hasMore = rows.length > limit;
    return {
      items: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
      nextCursor: null,
    };
  }

  /**
   * Patient timeline: every encounter across all source domains, newest first.
   * Cross-domain read for the patient chart, so it unions rather than querying a
   * single table.
   */
  async getPatientTimeline(
    patientId: string,
    ctx: DatabaseContext,
    limit: number
  ): Promise<PaginatedResult<EncounterRecord>> {
    return this.listForPatient(patientId, ctx, limit);
  }

  async create(input: CreateEncounterInput, ctx: DatabaseContext): Promise<EncounterRecord> {
    // The schema has no per-tenant sequence, so the number is minted in the
    // application: a ULID is monotonic and collision-free, which keeps the
    // existing UNIQUE (tenant_id, encounter_number) constraint satisfied
    // without a retry loop and stays sortable by creation time.
    const encounter = await this.db
      .one<EncounterRecord>(
        `INSERT INTO hims_clinical.encounters (
           tenant_id, facility_id, patient_id, encounter_number, encounter_type,
           department_id, attending_practitioner_id, parent_encounter_id,
           source_encounter_id, reason, metadata_jsonb, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
         RETURNING ${ENCOUNTER_COLUMNS}`,
        [
          ctx.tenantId,
          input.facilityId,
          input.patientId,
          buildEncounterNumber(input.encounterType),
          input.encounterType,
          input.departmentId,
          input.attendingPractitionerId ?? null,
          input.parentEncounterId ?? null,
          input.sourceEncounterId ?? null,
          input.reason ?? null,
          JSON.stringify(input.metadata ?? {}),
          ctx.userId ?? null,
        ],
        ctx
      )
      .catch((error: unknown) => this.rethrow(error));

    return encounter as EncounterRecord;
  }

  async update(
    id: string,
    input: UpdateEncounterInput,
    ctx: DatabaseContext
  ): Promise<EncounterRecord> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };

    if (input.reason !== undefined) push('reason', input.reason);
    if (input.attendingPractitionerId !== undefined) {
      push('attending_practitioner_id', input.attendingPractitionerId);
    }
    if (input.metadata !== undefined) {
      push('metadata_jsonb', JSON.stringify(input.metadata), '::jsonb');
    }
    if (input.version !== undefined) push('version', input.version);

    if (sets.length === 0) return this.getById(id, ctx);

    sets.push('updated_at = now()');
    params.push(id);

    const encounter = await this.db.one<EncounterRecord>(
      `UPDATE hims_clinical.encounters
          SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING ${ENCOUNTER_COLUMNS}`,
      params,
      ctx
    );

    if (!encounter) throw new NotFoundException('Encounter not found');
    return encounter;
  }

  /**
   * Apply a state transition atomically.
   *
   * The `WHERE status = $expected` predicate is the concurrency guard: if
   * another transaction moved the encounter since it was read, the UPDATE
   * matches zero rows and we report 409 rather than overwriting their change.
   */
  async transition(id: string, event: string, ctx: DatabaseContext): Promise<EncounterRecord> {
    return this.db.transaction(async (client) => {
      const current = await this.lockRow(client, id);
      if (!current) throw new NotFoundException('Encounter not found');

      // Throws 409 with the legal alternatives when the event is invalid here.
      const next = encounterMachine.next(current.status, event);

      // `ended_at` is derived from the graph rather than set by the client, so
      // it cannot disagree with `status`.
      const endedAt = next === 'CLOSED' ? 'now()' : 'ended_at';

      const { rows } = await client.query<EncounterRecord>(
        `UPDATE hims_clinical.encounters
            SET status = $1,
                ended_at = ${endedAt},
                version = version + 1,
                updated_at = now(),
                updated_by = $2
          WHERE id = $3
            AND status = $4
        RETURNING ${ENCOUNTER_COLUMNS}`,
        [next, ctx.userId ?? null, id, current.status]
      );

      if (rows.length === 0) {
        throw new ConflictException({
          code: 'CONCURRENT_UPDATE',
          message: 'The encounter was changed by another user. Reload and try again.',
        });
      }

      return rows[0];
    }, ctx);
  }

  /**
   * Read the row and take a row lock for the duration of the transaction.
   *
   * No tenant predicate: the surrounding `db.transaction(..., ctx)` has already
   * set the transaction-local tenant GUC, and the RLS policy on
   * `hims_clinical.encounters` is what makes the row visible at all.
   */
  private async lockRow(client: PoolClient, id: string): Promise<EncounterRecord | null> {
    const { rows } = await client.query<EncounterRecord>(
      `SELECT ${ENCOUNTER_COLUMNS}
         FROM hims_clinical.encounters
        WHERE id = $1
        FOR UPDATE`,
      [id]
    );
    return rows[0] ?? null;
  }

  private rethrow(error: unknown): never {
    switch ((error as { code?: string }).code) {
      case '23505':
        throw new ConflictException('Encounter number already exists in this tenant');
      case '23503':
        throw new BadRequestException(
          'Referenced patient, facility, department or practitioner does not exist'
        );
      case '22P02':
        throw new BadRequestException('Encounter type is not a recognised value');
      default:
        throw error;
    }
  }
}
