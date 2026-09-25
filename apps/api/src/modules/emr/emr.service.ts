import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { EmrTimelineItem } from '@hims/domain-types';

@Injectable()
export class EmrService {
  constructor(private readonly db: DatabaseService) {}

  async getTimeline(patientId: string, tenantId?: string): Promise<EmrTimelineItem[]> {
    return [
      {
        id: '16161616-1616-1616-1616-161616161601',
        timestamp: '2026-09-25T10:15:00.000Z',
        eventType: 'PRESCRIPTION',
        title: 'OPD Medication Prescribed',
        summary: 'Rx: Paracetamol 500mg TDS x 3d, Pantoprazole 40mg OD x 5d',
        sourceModule: 'OPD',
        sourceId: '12121212-1212-1212-1212-121212121201',
        practitionerName: 'Dr. Vikram Sarabhai',
        departmentName: 'General Medicine',
      },
      {
        id: '16161616-1616-1616-1616-161616161602',
        timestamp: '2026-09-25T11:30:00.000Z',
        eventType: 'LAB_RESULT',
        title: 'Laboratory Verification Complete',
        summary: 'CBC: Hb 13.5 g/dL (Normal); Fasting Glucose: 105 mg/dL (Borderline High)',
        sourceModule: 'LIS',
        sourceId: '50505050-5050-5050-5050-505050505001',
        practitionerName: 'Dr. A. Pathologist',
        departmentName: 'Central Pathology',
      },
      {
        id: '16161616-1616-1616-1616-161616161603',
        timestamp: '2026-09-25T12:00:00.000Z',
        eventType: 'RADIOLOGY_REPORT',
        title: 'Chest PA View X-Ray Report',
        summary: 'Impression: No active pulmonary parenchymal or pleural pathology detected.',
        sourceModule: 'RIS',
        sourceId: '60606060-6060-6060-6060-606060606001',
        practitionerName: 'Dr. R. Radiologist',
        departmentName: 'Radiology & Imaging',
      },
    ];
  }
}
