import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { PharmacyDispenseOrder } from '@hims/domain-types';

@Injectable()
export class PharmacyService {
  constructor(private readonly db: DatabaseService) {}

  async getDispenseQueue(tenantId?: string, facilityId?: string): Promise<PharmacyDispenseOrder[]> {
    return [
      {
        id: '14141414-1414-1414-1414-141414141401',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        dispenseNumber: 'DISP-2026-0034',
        patientId: '99999999-9999-9999-9999-999999999901',
        status: 'PENDING',
        items: [
          {
            drugId: '15151515-1515-1515-1515-151515151501',
            drugName: 'Paracetamol 500mg Tablet',
            batchNumber: 'BATCH-2026-A12',
            expiryDate: '2028-06-30',
            quantityOrdered: 10,
            quantityDispensed: 10,
            unitPrice: 2.5,
            totalAmount: 25.0,
          },
          {
            drugId: '15151515-1515-1515-1515-151515151502',
            drugName: 'Pantoprazole 40mg Tablet',
            batchNumber: 'BATCH-2026-P09',
            expiryDate: '2027-12-31',
            quantityOrdered: 5,
            quantityDispensed: 5,
            unitPrice: 8.0,
            totalAmount: 40.0,
          },
        ],
        totalAmount: 65.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async dispense(id: string, data: any, pharmacistId: string): Promise<PharmacyDispenseOrder> {
    const queue = await this.getDispenseQueue();
    const order = queue[0];
    order.status = 'DISPENSED';
    order.dispensedAt = new Date().toISOString();
    order.dispensedByPharmacistId = pharmacistId;
    return order;
  }
}
