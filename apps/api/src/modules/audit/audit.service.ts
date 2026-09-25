import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { AuditLogEntry } from '@hims/domain-types';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async getEvents(resourceId?: string, tenantId?: string): Promise<AuditLogEntry[]> {
    return [
      {
        id: '21212121-2121-2121-2121-212121212101',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: '22222222-2222-2222-2222-222222222221',
        actorUserId: '44444444-4444-4444-4444-444444444401',
        actorRole: 'DOCTOR',
        action: 'READ',
        resourceType: 'Patient360',
        resourceId: resourceId || '99999999-9999-9999-9999-999999999901',
        patientId: '99999999-9999-9999-9999-999999999901',
        correlationId: 'req-0925-101',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async logBreakGlass(patientId: string, reason: string, tenantId: string, facilityId: string, userId: string): Promise<AuditLogEntry> {
    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      actorUserId: userId,
      actorRole: 'DOCTOR',
      action: 'BREAK_GLASS',
      resourceType: 'PatientRecord',
      resourceId: patientId,
      patientId,
      reason,
      correlationId: `bg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
