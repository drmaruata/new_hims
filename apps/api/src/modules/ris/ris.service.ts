import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { RadiologyOrder } from '@hims/domain-types';

@Injectable()
export class RisService {
  constructor(private readonly db: DatabaseService) {}

  async getWorklist(tenantId?: string, facilityId?: string): Promise<RadiologyOrder[]> {
    return [
      {
        id: '60606060-6060-6060-6060-606060606001',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        orderNumber: 'RAD-2026-00129',
        accessionNumber: 'RAD-ACC-2026-0925-01',
        encounterId: '77777777-7777-7777-7777-777777777701',
        patientId: '99999999-9999-9999-9999-999999999901',
        orderingDoctorId: '44444444-4444-4444-4444-444444444401',
        modality: 'XRAY',
        bodyPart: 'Chest PA View',
        clinicalIndication: 'Persistent cough, rule out consolidation',
        status: 'REPORTED',
        pacsStudyInstanceUid: '1.2.840.113619.2.55.3.603371.20260925.101',
        report: {
          id: '70707070-7070-7070-7070-707070707001',
          radiologistId: '44444444-4444-4444-4444-444444444404',
          findings: 'Lung fields are clear bilaterally. Cardiothoracic ratio is normal. Both costophrenic angles are acute and clear.',
          impression: 'No active pulmonary parenchymal or pleural pathology detected.',
          isCriticalFinding: false,
          reportedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async createOrder(data: any, tenantId: string, facilityId: string, doctorId: string): Promise<RadiologyOrder> {
    const orderNumber = `RAD-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const accessionNumber = `RAD-ACC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      orderNumber,
      accessionNumber,
      encounterId: data.encounterId,
      patientId: data.patientId,
      orderingDoctorId: doctorId,
      modality: data.modality,
      bodyPart: data.bodyPart,
      clinicalIndication: data.clinicalIndication,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  async submitReport(id: string, reportData: any, radiologistId: string): Promise<RadiologyOrder> {
    const list = await this.getWorklist();
    const order = list[0];
    order.status = 'REPORTED';
    order.report = {
      id: crypto.randomUUID(),
      radiologistId,
      findings: reportData.findings,
      impression: reportData.impression,
      isCriticalFinding: reportData.isCriticalFinding || false,
      reportedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };
    return order;
  }
}
