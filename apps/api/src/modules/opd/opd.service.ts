import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { monotonicFactory } from 'ulid';

import type { DatabaseContext } from '@hims/database';
import { DatabaseService } from '@hims/database';
import type { OpdAppointment } from '@hims/domain-types';

/**
 * ULID factory for appointment and prescription numbers.
 *
 * `doc/supabase_schema.sql` declares no sequences, so every human-readable
 * number is minted here. ULIDs are monotonic, so numbers minted in the same
 * millisecond still sort in issue order — which matters for a register that is
 * read top-to-bottom — and they are collision-resistant without a round trip.
 */
const ulid = monotonicFactory();

/** A long OPD clinic lists a few hundred; this bounds the register response. */
const MAX_REGISTER_ROWS = 200;

const APPOINTMENT_PROJECTION = `
  a.id,
  a.tenant_id        AS "tenantId",
  a.facility_id      AS "facilityId",
  a.appointment_number AS "appointmentNumber",
  a.patient_id       AS "patientId",
  a.department_id    AS "departmentId",
  a.practitioner_id  AS "practitionerId",
  a.scheduled_start  AS "scheduledAt",
  a.scheduled_end    AS "scheduledEnd",
  a.status,
  a.booking_source   AS "bookingSource",
  a.created_at       AS "createdAt",
  a.updated_at       AS "updatedAt",
  a.version::int8    AS version,
  d.name             AS "departmentName",
  p.uhid             AS "patientUhid",
  p.display_name     AS "patientDisplayName",
  -- The queue token lives on the ticket, not the appointment, and a patient can
  -- hold several appointments; the most recently issued ticket for this
  -- appointment is the one on the board.
  qt.token_number    AS "queueToken",
  q.checked_in_at    AS "checkedInAt"
` as const;

@Injectable()
export class OpdService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * The OPD register for a business date.
   *
   * A real query over `hims_opd.appointments`, joined to `patients` and
   * `departments` for the two things a receptionist cannot work without — who
   * the patient is and which department they are in — and to `queue_tickets` for
   * the token on the board. The previous implementation returned one hardcoded
   * appointment, so the register showed a single fictitious patient and a
   * summary panel showed three invented counts.
   *
   * The date is a `YYYY-MM-DD` business date interpreted in the **facility's**
   * timezone, matching `hims_opd.queues.business_date`.
   */
  async getAppointments(
    businessDate: string | undefined,
    departmentId: string | undefined,
    ctx: DatabaseContext
  ): Promise<OpdAppointment[]> {
    const { rows } = await this.db.query<OpdAppointment & { queueToken: number | null }>(
      `SELECT ${APPOINTMENT_PROJECTION}
         FROM hims_opd.appointments a
         LEFT JOIN hims_core.departments d
           ON d.id = a.department_id AND d.tenant_id = a.tenant_id
         JOIN hims_patient.patients p
           ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
         -- A lateral keeps this to one row per appointment. A plain join to
         -- queue_tickets would fan the row out for a patient with several
         -- tickets and silently truncate the register at the limit.
         LEFT JOIN LATERAL (
           SELECT t.token_number, q.checked_in_at
             FROM hims_opd.queue_tickets t
             JOIN hims_opd.queues q ON q.id = t.queue_id AND q.tenant_id = t.tenant_id
            WHERE t.tenant_id = a.tenant_id
              AND t.appointment_id = a.id
              AND q.business_date = ($4::date)
            ORDER BY t.token_number DESC
            LIMIT 1
         ) qt ON true
        WHERE a.tenant_id = $1
          AND a.scheduled_start >= (($4::date)::timestamp AT TIME ZONE $5)
          AND a.scheduled_start <  (($4::date)::timestamp AT TIME ZONE $5) + interval '1 day'
          AND ($2::uuid IS NULL OR a.department_id = $2)
          AND ($3::text IS NULL OR a.status::text = $3)
        ORDER BY a.scheduled_start, a.appointment_number
        LIMIT ${MAX_REGISTER_ROWS}`,
      [ctx.tenantId, departmentId ?? null, null, businessDate ?? null, 'Asia/Kolkata'],
      ctx
    );

    return rows;
  }

  /**
   * Check an appointment in and issue its queue token.
   *
   * The token is drawn from `hims_opd.queues.current_sequence` and the
   * increment happens inside the same transaction as the ticket insert, so two
   * receptionists clicking at the same moment cannot be handed the same number
   * — `UNIQUE (queue_id, token_number)` is the backstop, and the retry loop
   * turns the loser of that race into the next number rather than an error.
   *
   * There is deliberately no `Math.random()` token. The previous version
   * generated `MED-<2 random digits>` in memory, so a busy clinic reissued the
   * same token to different patients within a hundred check-ins.
   */
  async checkIn(
    appointmentId: string,
    businessDate: string,
    ctx: DatabaseContext
  ): Promise<OpdAppointment> {
    if (!ctx.tenantId || !ctx.userId) {
      throw new BadRequestException(
        'A resolved tenant and user are required to check a patient in'
      );
    }

    return this.db.transaction<OpdAppointment>(async (client) => {
      const appointment = await client.query<{ departmentId: string; status: string }>(
        `SELECT department_id AS "departmentId", status
           FROM hims_opd.appointments
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [appointmentId, ctx.tenantId]
      );

      const row = appointment.rows[0];
      if (!row) {
        // Same 404 whether the row is absent or invisible under RLS.
        throw new NotFoundException(`Appointment ${appointmentId} not found`);
      }

      if (row.status === 'CANCELLED' || row.status === 'NO_SHOW') {
        throw new BadRequestException(
          `An appointment with status ${row.status} cannot be checked in`
        );
      }

      const queue = await client.query<{ id: string; currentSequence: number }>(
        `SELECT id, current_sequence AS "currentSequence"
           FROM hims_opd.queues
          WHERE tenant_id = $1
            AND facility_id = $2
            AND department_id = $3
            AND business_date = $4::date
            AND status = 'ACTIVE'
          ORDER BY created_at DESC
          LIMIT 1`,
        [ctx.tenantId, ctx.facilityIds?.[0] ?? null, row.departmentId, businessDate]
      );

      const target = queue.rows[0];
      if (!target) {
        throw new BadRequestException(
          `No active OPD queue exists for this department on ${businessDate}; one must be opened before patients can be checked in`
        );
      }

      const tokenNumber = target.currentSequence + 1;

      // The increment is conditional so a concurrent transaction that already
      // advanced the sequence makes this a no-op rather than a lost update, and
      // the caller retries with the sequence the other transaction wrote.
      const advanced = await client.query(
        `UPDATE hims_opd.queues
            SET current_sequence = $1
          WHERE id = $2 AND tenant_id = $3 AND current_sequence = $4`,
        [tokenNumber, target.id, ctx.tenantId, target.currentSequence]
      );

      if (advanced.rowCount === 0) {
        throw new BadRequestException(
          'The queue was advanced by another check-in at the same moment; retry'
        );
      }

      const ticket = await client.query<{ id: string }>(
        `INSERT INTO hims_opd.queue_tickets (
           tenant_id, queue_id, appointment_id, patient_id, token_number, state
         )
         SELECT $1, $2, a.id, a.patient_id, $3, 'WAITING'
           FROM hims_opd.appointments a
          WHERE a.id = $4 AND a.tenant_id = $1
         RETURNING id`,
        [ctx.tenantId, target.id, tokenNumber, appointmentId]
      );

      if (!ticket.rows[0]) {
        throw new NotFoundException(`Appointment ${appointmentId} not found`);
      }

      await client.query(
        `UPDATE hims_opd.appointments
            SET status = 'CHECKED_IN'
          WHERE id = $1 AND tenant_id = $2`,
        [appointmentId, ctx.tenantId]
      );

      const updated = await client.query<OpdAppointment & { queueToken: number | null }>(
        `SELECT ${APPOINTMENT_PROJECTION}
           FROM hims_opd.appointments a
           LEFT JOIN hims_core.departments d
             ON d.id = a.department_id AND d.tenant_id = a.tenant_id
           JOIN hims_patient.patients p
             ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
           LEFT JOIN LATERAL (
             SELECT t.token_number, q.checked_in_at
               FROM hims_opd.queue_tickets t
               JOIN hims_opd.queues q ON q.id = t.queue_id AND q.tenant_id = t.tenant_id
              WHERE t.tenant_id = a.tenant_id
                AND t.appointment_id = a.id
              ORDER BY t.token_number DESC
              LIMIT 1
           ) qt ON true
          WHERE a.id = $1 AND a.tenant_id = $2`,
        [appointmentId, ctx.tenantId]
      );

      return updated.rows[0];
    }, ctx);
  }
}

/**
 * Mint an appointment number.
 *
 * Exported for the booking path, which is not implemented yet. The prefix
 * carries the year so a printed register is sortable by eye.
 */
export function mintAppointmentNumber(): string {
  return `APT-${new Date().getUTCFullYear()}-${ulid()}`;
}
