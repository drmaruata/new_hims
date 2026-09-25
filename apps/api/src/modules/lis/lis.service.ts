import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { LabOrder } from '@hims/domain-types';

@Injectable()
export class LisService {
  constructor(private readonly db: DatabaseService) {}

  async getOrders(status?: string, tenantId?: string, facilityId?: string): Promise<LabOrder[]> {
    return [
      {
        id: '50505050-5050-5050-5050-505050505001',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        orderNumber: 'LAB-2026-00341',
        accessionNumber: 'ACC-2026-0925-01',
        encounterId: '77777777-7777-7777-7777-777777777701',
        patientId: '99999999-9999-9999-9999-999999999901',
        requestingDoctorId: '44444444-4444-4444-4444-444444444401',
        priority: 'ROUTINE',
        status: 'PROCESSING',
        tests: [
          {
            testCode: 'CBC_HB',
            testName: 'Hemoglobin',
            category: 'HEMATOLOGY',
            specimenType: 'WHOLE_BLOOD',
            resultValue: '13.5',
            numericResult: 13.5,
            unit: 'g/dL',
            referenceRange: '13.0 - 17.0',
            isAbnormal: false,
            isCritical: false,
          },
          {
            testCode: 'GLU_FASTING',
            testName: 'Fasting Blood Glucose',
            category: 'BIOCHEMISTRY',
            specimenType: 'PLASMA',
            resultValue: '105',
            numericResult: 105,
            unit: 'mg/dL',
            referenceRange: '70 - 100',
            isAbnormal: true,
            isCritical: false,
          },
        ],
        orderedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async createOrder(data: any, tenantId: string, facilityId: string, doctorId: string): Promise<LabOrder> {
    const orderNumber = `LAB-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const accessionNumber = `ACC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      orderNumber,
      accessionNumber,
      encounterId: data.encounterId,
      patientId: data.patientId,
      requestingDoctorId: doctorId,
      priority: data.priority || 'ROUTINE',
      status: 'ORDERED',
      tests: (data.testCodes || ['CBC_HB']).map((code: string) => ({
        testCode: code,
        testName: code.replace('_', ' '),
        category: 'HEMATOLOGY',
        specimenType: 'WHOLE_BLOOD',
      })),
      orderedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  async verifyResult(id: string, testCode: string, resultData: any, pathologistId: string): Promise<LabOrder> {
    const orders = await this.getOrders();
    const order = orders[0];
    const test = order.tests.find(t => t.testCode === testCode) || order.tests[0];
    test.resultValue = resultData.resultValue;
    test.numericResult = resultData.numericResult;
    test.isAbnormal = resultData.isAbnormal || false;
    test.isCritical = resultData.isCritical || false;
    test.verifiedBy = pathologistId;
    test.verifiedAt = new Date().toISOString();
    order.status = 'VERIFIED';
    return order;
  }
}
