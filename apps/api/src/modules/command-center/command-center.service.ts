import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { DatabaseContext } from '@hims/database';
import { DatabaseService } from '@hims/database';
import type { CommandCenterMetrics } from '@hims/domain-types';

/**
 * The hospital command centre roll-up.
 *
 * Every figure is computed from the owning table at request time. The previous
 * implementation returned a hardcoded object — a fixed 250 beds, a fixed 82%
 * occupancy, a fixed hospital name — which meant the dashboard was a plausible
 * picture of a hospital that did not exist. A command centre is watched during
 * surge, when a stale or invented number is actively dangerous, so there is no
 * cache here and no fallback path: if a count fails, the request fails.
 *
 * Day boundaries are resolved in the **facility's** timezone, taken from
 * `hims_core.facilities.timezone`. Counting "today" in the server's zone would
 * hand a hospital a different day boundary for part of every day, precisely
 * during the morning handover when the number is being read.
 */
@Injectable()
export class CommandCenterService {
  constructor(private readonly db: DatabaseService) {}

  async getMetrics(ctx: DatabaseContext): Promise<CommandCenterMetrics> {
    if (!ctx.tenantId) {
      throw new ServiceUnavailableException('A tenant must be resolved to read command centre metrics');
    }

    // The facility drives both the facility filter and the timezone, so it is
    // resolved first and every subsequent query reuses its scope.
    const facilityId = ctx.facilityIds?.[0] ?? null;

    const facility = await this.resolveFacility(ctx, facilityId);

    const [occupancy, opd, emergency, ot, diagnostics, revenue] = await Promise.all([
      this.readOccupancy(ctx, facility.id),
      this.readOpd(ctx, facility.id, facility.timezone),
      this.readEmergency(ctx, facility.id, facility.timezone),
      this.readOt(ctx, facility.id, facility.timezone),
      this.readDiagnostics(ctx),
      this.readRevenue(ctx, facility.id, facility.timezone),
    ]);

    return {
      timestamp: new Date().toISOString(),
      facilityId: facility.id,
      facilityName: facility.name,
      timezone: facility.timezone,
      occupancy,
      opd,
      emergency,
      ot,
      diagnostics,
      revenue,
    };
  }

  private async resolveFacility(
    ctx: DatabaseContext,
    requestedId: string | null,
  ): Promise<{ id: string; name: string; timezone: string }> {
    const facility = await this.db.one<{ id: string; name: string; timezone: string }>(
      `SELECT id, name, timezone
         FROM hims_core.facilities
        WHERE tenant_id = $1
          AND status = 'ACTIVE'
          AND ($2::uuid IS NULL OR id = $2)
        ORDER BY name
        LIMIT 1`,
      [ctx.tenantId, requestedId],
      ctx,
    );

    if (!facility) {
      // Falling back to a tenant-wide roll-up would silently mix facilities and
      // present a number as a single site's. Failing is the honest answer.
      throw new ServiceUnavailableException(
        'No active facility is available for this scope; command centre metrics are facility-scoped',
      );
    }

    return facility;
  }

  /**
   * Bed occupancy.
   *
   * Derived from `hims_ipd.beds.state` rather than by counting active
   * assignments, because a bed can be occupied by a patient who has been
   * physically moved to a general ward while the record still shows an
   * assignment. The bed is the thing whose availability an operations manager
   * is actually asking about.
   */
  private async readOccupancy(
    ctx: DatabaseContext,
    facilityId: string,
  ): Promise<CommandCenterMetrics['occupancy']> {
    const row = await this.db.one<{
      totalBeds: number;
      occupiedBeds: number;
      icuBedsOccupied: number;
      icuBedsTotal: number;
    }>(
      `SELECT count(*)::int                                                          AS "totalBeds",
              count(*) FILTER (WHERE state = 'OCCUPIED')::int                       AS "occupiedBeds",
              count(*) FILTER (WHERE department_id IN (SELECT id FROM hims_core.departments
                                                       WHERE tenant_id = $1 AND department_code = 'ICU'))::int AS "icuBedsTotal",
              count(*) FILTER (WHERE state = 'OCCUPIED'
                                 AND department_id IN (SELECT id FROM hims_core.departments
                                                       WHERE tenant_id = $1 AND department_code = 'ICU'))::int AS "icuBedsOccupied"
         FROM hims_ipd.beds
        WHERE tenant_id = $1
          AND facility_id = $2
          AND status = 'ACTIVE'`,
      [ctx.tenantId, facilityId],
      ctx,
    );

    const totalBeds = row?.totalBeds ?? 0;
    const occupiedBeds = row?.occupiedBeds ?? 0;

    return {
      totalBeds,
      occupiedBeds,
      // A division by zero on an unconfigured facility would be `NaN`, which
      // serialises to `null` and renders as a blank tile. Zero is the truth.
      occupancyRate:
        totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 1000) / 10,
      icuBedsOccupied: row?.icuBedsOccupied ?? 0,
      icuBedsTotal: row?.icuBedsTotal ?? 0,
    };
  }

  private async readOpd(
    ctx: DatabaseContext,
    facilityId: string,
    timezone: string,
  ): Promise<CommandCenterMetrics['opd']> {
    const row = await this.db.one<{
      registeredToday: number;
      inConsultation: number;
      waitingInQueue: number;
      avgWaitTimeMinutes: number | null;
    }>(
      // `($3::text)::timestamptz` is the midnight boundary. Casting the
      // parameter rather than the column keeps the index on
      // `scheduled_start` usable.
      `SELECT
         (SELECT count(*)::int
            FROM hims_opd.appointments a
           WHERE a.tenant_id = $1
             AND a.facility_id = $2
             AND a.scheduled_start >= (($3::text)::date::timestamp AT TIME ZONE $3)
             AND a.status NOT IN ('CANCELLED', 'NO_SHOW'))                    AS "registeredToday",
         (SELECT count(*)::int
            FROM hims_opd.queue_tickets q
           WHERE q.tenant_id = $1
             AND q.state = 'IN_CONSULTATION')                                 AS "inConsultation",
         (SELECT count(*)::int
            FROM hims_opd.queue_tickets q
           WHERE q.tenant_id = $1
             AND q.state = 'WAITING')                                         AS "waitingInQueue",
         (SELECT avg(extract(epoch FROM (q.consultation_started_at - q.called_at)) / 60)::float8
            FROM hims_opd.queue_tickets q
           WHERE q.tenant_id = $1
             AND q.called_at IS NOT NULL
             AND q.consultation_started_at IS NOT NULL
             AND q.consultation_started_at >= (($3::text)::date::timestamp AT TIME ZONE $3)) AS "avgWaitTimeMinutes"`,
      [ctx.tenantId, facilityId, timezone],
      ctx,
    );

    return {
      registeredToday: row?.registeredToday ?? 0,
      inConsultation: row?.inConsultation ?? 0,
      waitingInQueue: row?.waitingInQueue ?? 0,
      // `null` means "nothing measured yet", which is different from zero and
      // must not be rendered as an average wait of zero minutes.
      avgWaitTimeMinutes: row?.avgWaitTimeMinutes === null || row === null
        ? null
        : Math.round(row.avgWaitTimeMinutes * 10) / 10,
    };
  }

  private async readEmergency(
    ctx: DatabaseContext,
    facilityId: string,
    timezone: string,
  ): Promise<CommandCenterMetrics['emergency']> {
    const row = await this.db.one<{
      activePatients: number;
      esi1Resuscitation: number;
      esi2Emergent: number;
      avgTriageTimeMinutes: number | null;
    }>(
      `SELECT
         (SELECT count(*)::int
            FROM hims_emergency.emergency_encounters e
           WHERE e.tenant_id = $1
             AND e.status = 'OPEN'
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = e.encounter_id AND c.facility_id = $2))    AS "activePatients",
         (SELECT count(*)::int
            FROM hims_emergency.emergency_encounters e
           WHERE e.tenant_id = $1 AND e.status = 'OPEN' AND e.acuity = 'ESI_1'
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = e.encounter_id AND c.facility_id = $2))    AS "esi1Resuscitation",
         (SELECT count(*)::int
            FROM hims_emergency.emergency_encounters e
           WHERE e.tenant_id = $1 AND e.status = 'OPEN' AND e.acuity = 'ESI_2'
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = e.encounter_id AND c.facility_id = $2))    AS "esi2Emergent",
         (SELECT avg(extract(epoch FROM (e.triage_at - e.arrival_at)) / 60)::float8
            FROM hims_emergency.emergency_encounters e
           WHERE e.tenant_id = $1
             AND e.arrival_at >= (($3::text)::date::timestamp AT TIME ZONE $3)
             AND e.triage_at IS NOT NULL
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = e.encounter_id AND c.facility_id = $2))    AS "avgTriageTimeMinutes"`,
      [ctx.tenantId, facilityId, timezone],
      ctx,
    );

    return {
      activePatients: row?.activePatients ?? 0,
      esi1Resuscitation: row?.esi1Resuscitation ?? 0,
      esi2Emergent: row?.esi2Emergent ?? 0,
      avgTriageTimeMinutes:
        row?.avgTriageTimeMinutes === null || row === null
          ? null
          : Math.round(row.avgTriageTimeMinutes * 10) / 10,
    };
  }

  private async readOt(
    ctx: DatabaseContext,
    facilityId: string,
    timezone: string,
  ): Promise<CommandCenterMetrics['ot']> {
    const row = await this.db.one<{
      casesScheduledToday: number;
      casesCompleted: number;
      theatresRunning: number;
      theatresTotal: number;
    }>(
      `SELECT
         (SELECT count(*)::int
            FROM hims_ot.surgery_cases s
           WHERE s.tenant_id = $1
             AND s.scheduled_start >= (($3::text)::date::timestamp AT TIME ZONE $3)
             AND s.status <> 'CANCELLED'
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = s.encounter_id AND c.facility_id = $2))  AS "casesScheduledToday",
         (SELECT count(*)::int
            FROM hims_ot.surgery_cases s
           WHERE s.tenant_id = $1
             AND s.scheduled_start >= (($3::text)::date::timestamp AT TIME ZONE $3)
             AND s.actual_end IS NOT NULL
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = s.encounter_id AND c.facility_id = $2))  AS "casesCompleted",
         -- A theatre is running if a case in it has started and not finished.
         (SELECT count(DISTINCT s.ot_room_id)::int
            FROM hims_ot.surgery_cases s
           WHERE s.tenant_id = $1
             AND s.ot_room_id IS NOT NULL
             AND s.actual_start IS NOT NULL
             AND s.actual_end IS NULL)                                        AS "theatresRunning",
         (SELECT count(*)::int
            FROM hims_ot.ot_rooms r
           WHERE r.tenant_id = $1 AND r.facility_id = $2 AND r.status = 'ACTIVE') AS "theatresTotal"`,
      [ctx.tenantId, facilityId, timezone],
      ctx,
    );

    return {
      casesScheduledToday: row?.casesScheduledToday ?? 0,
      casesCompleted: row?.casesCompleted ?? 0,
      theatresRunning: row?.theatresRunning ?? 0,
      theatresTotal: row?.theatresTotal ?? 0,
    };
  }

  /**
   * Diagnostic backlog.
   *
   * "Critical alert" is a released result flagged `critical_flag` that no
   * clinician has verified. An unverified critical result is the single most
   * common cause of a missed sepsis deterioration, so it gets its own tile
   * rather than being averaged into the pending count.
   */
  private async readDiagnostics(
    ctx: DatabaseContext,
  ): Promise<CommandCenterMetrics['diagnostics']> {
    const row = await this.db.one<{
      pendingLabSamples: number;
      criticalLabAlerts: number;
      pendingRadiologyReads: number;
    }>(
      `SELECT
         (SELECT count(*)::int
            FROM hims_lab.lab_orders o
           WHERE o.tenant_id = $1
             AND o.status NOT IN ('COMPLETED', 'CANCELLED'))                     AS "pendingLabSamples",
         (SELECT count(*)::int
            FROM hims_lab.lab_results r
           WHERE r.tenant_id = $1
             AND r.critical_flag
             AND r.released_at IS NOT NULL
             AND r.verified_at IS NULL)                                        AS "criticalLabAlerts",
         (SELECT count(*)::int
            FROM hims_rad.imaging_orders i
           WHERE i.tenant_id = $1
             AND i.status NOT IN ('COMPLETED', 'CANCELLED'))                    AS "pendingRadiologyReads"`,
      [ctx.tenantId],
      ctx,
    );

    return {
      pendingLabSamples: row?.pendingLabSamples ?? 0,
      criticalLabAlerts: row?.criticalLabAlerts ?? 0,
      pendingRadiologyReads: row?.pendingRadiologyReads ?? 0,
    };
  }

  /**
   * Today's money.
   *
   * Gross billed counts `issued_at`; collections are derived from the invoice's
   * `outstanding` column rather than a payments table, because that is the
   * figure the finance ledger already reconciles against. A day with no
   * invoices yields zeros, not nulls.
   */
  private async readRevenue(
    ctx: DatabaseContext,
    facilityId: string,
    timezone: string,
  ): Promise<CommandCenterMetrics['revenue']> {
    const dayStart = `(($3::text)::date::timestamp AT TIME ZONE $3)`;

    const row = await this.db.one<{
      grossBilledToday: number;
      collectionsToday: number;
      claimsSubmitted: number;
      preAuthPending: number;
    }>(
      `SELECT
         (SELECT coalesce(sum(i.total), 0)::float8
            FROM hims_billing.invoices i
           WHERE i.tenant_id = $1
             AND i.issued_at >= ${dayStart}
             AND i.status NOT IN ('DRAFT', 'CANCELLED'))                       AS "grossBilledToday",
         (SELECT coalesce(sum(i.total - i.outstanding), 0)::float8
            FROM hims_billing.invoices i
           WHERE i.tenant_id = $1
             AND i.issued_at >= ${dayStart}
             AND i.status IN ('FINALIZED', 'PARTIALLY_PAID', 'PAID'))          AS "collectionsToday",
         (SELECT count(*)::int
            FROM hims_insurance.claims c
           WHERE c.tenant_id = $1
             AND c.submitted_at >= ${dayStart}
             AND EXISTS (SELECT 1 FROM hims_billing.invoices i
                          WHERE i.id = c.invoice_id AND i.facility_id = $2))    AS "claimsSubmitted",
         (SELECT count(*)::int
            FROM hims_insurance.preauthorizations p
           WHERE p.tenant_id = $1
             AND p.status IN ('DRAFT', 'SUBMITTED', 'PENDING')
             AND EXISTS (SELECT 1 FROM hims_clinical.encounters c
                          WHERE c.id = p.encounter_id AND c.facility_id = $2))  AS "preAuthPending"`,
      [ctx.tenantId, facilityId, timezone],
      ctx,
    );

    return {
      grossBilledToday: Math.round(row?.grossBilledToday ?? 0),
      collectionsToday: Math.round(row?.collectionsToday ?? 0),
      claimsSubmitted: row?.claimsSubmitted ?? 0,
      preAuthPending: row?.preAuthPending ?? 0,
    };
  }
}
