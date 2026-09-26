import { Injectable } from '@nestjs/common';
import { DatabaseService, type DatabaseContext } from '@hims/database';
import type { AuditLogEntry } from '@hims/domain-types';

interface AuditRow {
  event_id: string;
  tenant_id: string;
  facility_id: string | null;
  actor_user_id: string | null;
  actor_type: string | null;
  action: AuditLogEntry['action'];
  resource_type: string;
  resource_id: string | null;
  patient_id: string | null;
  metadata_jsonb: Record<string, unknown>;
  correlation_id: string | null;
  occurred_at: string;
}

function mapAuditRow(row: AuditRow): AuditLogEntry {
  return {
    id: row.event_id,
    tenantId: row.tenant_id,
    facilityId: row.facility_id,
    actorUserId: row.actor_user_id ?? '',
    actorRole: String(row.metadata_jsonb.actorRole ?? 'UNKNOWN'),
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? '',
    patientId: row.patient_id ?? undefined,
    reason: typeof row.metadata_jsonb.reason === 'string' ? row.metadata_jsonb.reason : undefined,
    correlationId: row.correlation_id ?? '',
    ipAddress:
      typeof row.metadata_jsonb.ipAddress === 'string' ? row.metadata_jsonb.ipAddress : undefined,
    createdAt: row.occurred_at,
    updatedAt: row.occurred_at,
    version: 1,
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async getEvents(resourceId: string | undefined, ctx: DatabaseContext): Promise<AuditLogEntry[]> {
    const { rows } = await this.db.query<AuditRow>(
      `SELECT event_id,
              tenant_id,
              facility_id,
              actor_user_id,
              actor_type,
              action,
              resource_type,
              resource_id,
              patient_id,
              metadata_jsonb,
              correlation_id,
              occurred_at
         FROM hims_audit.audit_events
        WHERE ($1::uuid IS NULL OR resource_id = $1::uuid)
        ORDER BY occurred_at DESC
        LIMIT 500`,
      [resourceId ?? null],
      ctx
    );

    return rows.map(mapAuditRow);
  }

  async logBreakGlass(input: {
    patientId: string;
    reason: string;
    ctx: DatabaseContext;
    actorRole: string;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    const { patientId, reason, ctx, actorRole, correlationId, ipAddress, userAgent } = input;

    return this.db.transaction(async (client) => {
      const metadata = {
        actorRole,
        reason,
        ipAddress,
        userAgent,
        source: 'hims-api',
      };

      const audit = await client.query<AuditRow>(
        `INSERT INTO hims_audit.audit_events
          (tenant_id, facility_id, actor_user_id, actor_type, action,
           resource_type, resource_id, patient_id, metadata_jsonb, correlation_id)
         VALUES
          ($1, $2, $3, 'USER', 'BREAK_GLASS',
           'PatientRecord', $4, $4, $5::jsonb, $6)
         RETURNING event_id, tenant_id, facility_id, actor_user_id, actor_type,
                   action, resource_type, resource_id, patient_id,
                   metadata_jsonb, correlation_id, occurred_at`,
        [
          ctx.tenantId,
          ctx.facilityId ?? null,
          ctx.userId ?? null,
          patientId,
          JSON.stringify(metadata),
          correlationId,
        ]
      );

      await client.query(
        `INSERT INTO hims_audit.data_access_events
          (tenant_id, user_id, patient_id, reason_code, access_type,
           module, encounter_id, break_glass)
         VALUES
          ($1, $2, $3, 'BREAK_GLASS', 'EMERGENCY',
           'AUDIT', NULL, true)`,
        [ctx.tenantId, ctx.userId, patientId]
      );

      return mapAuditRow(audit.rows[0]);
    }, ctx);
  }
}
