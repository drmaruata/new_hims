import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { EmergencyEncounter } from '@hims/domain-types';

@Injectable()
export class EmergencyService {
  constructor(private readonly db: DatabaseService) {}

  async getActiveCases(tenantId?: string, facilityId?: string): Promise<EmergencyEncounter[]> {
    return [
      {
        id: '80808080-8080-8080-8080-808080808001',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        emergencyNumber: 'ED-2026-0042',
        patientId: '99999999-9999-9999-9999-999999999901',
        arrivedAt: new Date().toISOString(),
        arrivalMode: 'AMBULANCE',
        triageAcuity: 'ESI_2_EMERGENT',
        isMlc: false,
        triageNurseId: '44444444-4444-4444-4444-444444444402',
        attendingPhysicianId: '44444444-4444-4444-4444-444444444401',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async triage(data: any, tenantId: string, facilityId: string, nurseId: string): Promise<EmergencyEncounter> {
    const emergencyNumber = `ED-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      emergencyNumber,
      patientId: data.patientId,
      arrivedAt: new Date().toISOString(),
      arrivalMode: data.arrivalMode || 'WALK_IN',
      triageAcuity: data.triageAcuity || 'ESI_3_URGENT',
      isMlc: data.isMlc || false,
      mlcNumber: data.mlcNumber,
      triageNurseId: nurseId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
