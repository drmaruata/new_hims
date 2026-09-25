import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateLabOrderDto } from '@hims/validation';
import { DatabaseService } from '@hims/database';
import type { LabOrder } from '@hims/domain-types';
import type { VerifyLabResultInput } from './dto/lis.dto.js';

@Injectable()
export class LisService {
  constructor(private readonly db: DatabaseService) {}

  async getOrders(status?: string, tenantId?: string | null, facilityId?: string | null): Promise<LabOrder[]> {
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

  async createOrder(
    input: CreateLabOrderDto,
    tenantId: string,
    facilityId: string,
    doctorId: string,
  ): Promise<LabOrder> {
    const orderNumber = `LAB-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const accessionNumber = `ACC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      orderNumber,
      accessionNumber,
      encounterId: input.encounterId,
      patientId: input.patientId,
      requestingDoctorId: doctorId,
      priority: input.priority,
      status: 'ORDERED',
      tests: input.testCodes.map((code) => ({
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

  async verifyResult(
    id: string,
    testCode: string,
    input: VerifyLabResultInput,
    pathologistId: string,
  ): Promise<LabOrder> {
    const orders = await this.getOrders();
    const order = orders.find((candidate) => candidate.id === id);

    // Verifying the wrong order would sign off an unrelated patient's result,
    // so an unknown id is a 404 rather than a fallback to the first row.
    if (!order) {
      throw new NotFoundException(`No laboratory order ${id} is visible to this caller`);
    }

    const test = order.tests.find((candidate) => candidate.testCode === testCode);
    if (!test) {
      throw new NotFoundException(`Order ${order.orderNumber} has no test ${testCode}`);
    }

    test.resultValue = input.resultValue;
    test.numericResult = input.numericResult;
    test.isAbnormal = input.isAbnormal ?? false;
    test.isCritical = input.isCritical ?? false;
    test.verifiedBy = pathologistId;
    test.verifiedAt = new Date().toISOString();
    order.status = 'VERIFIED';
    return order;
  }
}

