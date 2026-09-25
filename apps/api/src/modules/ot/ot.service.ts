import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { SurgeryCase } from '@hims/domain-types';

@Injectable()
export class OtService {
  constructor(private readonly db: DatabaseService) {}

  async getSchedule(date?: string, tenantId?: string, facilityId?: string): Promise<SurgeryCase[]> {
    return [
      {
        id: '90909090-9090-9090-9090-909090909001',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        caseNumber: 'OT-2026-0038',
        encounterId: '77777777-7777-7777-7777-777777777702',
        patientId: '99999999-9999-9999-9999-999999999901',
        otRoomId: '91919191-9191-9191-9191-919191919101',
        scheduledStart: '2026-09-25T14:00:00.000Z',
        scheduledEnd: '2026-09-25T16:30:00.000Z',
        leadSurgeonId: '44444444-4444-4444-4444-444444444401',
        anaesthetistId: '44444444-4444-4444-4444-444444444402',
        procedureName: 'Laparoscopic Cholecystectomy',
        status: 'SCHEDULED',
        whoChecklistCompleted: true,
        preOpDiagnosis: 'Symptomatic Cholelithiasis',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async bookCase(data: any, tenantId: string, facilityId: string): Promise<SurgeryCase> {
    const caseNumber = `OT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      caseNumber,
      encounterId: data.encounterId,
      patientId: data.patientId,
      otRoomId: data.otRoomId,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      leadSurgeonId: data.leadSurgeonId,
      anaesthetistId: data.anaesthetistId,
      procedureName: data.procedureName,
      status: 'SCHEDULED',
      whoChecklistCompleted: false,
      preOpDiagnosis: data.preOpDiagnosis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
