import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@hims/database';
import type { Invoice } from '@hims/domain-types';
import type { CreateInvoiceInput, InvoiceLineInput } from './dto/billing.dto.js';

@Injectable()
export class BillingService {
  constructor(private readonly db: DatabaseService) {}

  async getInvoices(
    patientId?: string,
    tenantId?: string,
    facilityId?: string | null
  ): Promise<Invoice[]> {
    return [
      {
        id: '18181818-1818-4818-8818-181818181801',
        tenantId: tenantId || '11111111-1111-4111-8111-111111111111',
        facilityId: facilityId || '22222222-2222-4222-8222-222222222221',
        invoiceNumber: 'INV-2026-00912',
        patientId: patientId || '99999999-9999-4999-8999-999999999901',
        encounterId: '77777777-7777-4777-8777-777777777701',
        totalGrossAmount: 1250,
        discountAmount: 0,
        taxAmount: 0,
        netPayableAmount: 1250,
        paidAmount: 1250,
        balanceAmount: 0,
        status: 'PAID',
        items: [
          {
            serviceCode: 'OPD_CONSULT',
            description: 'General Medicine Consultation Fee',
            departmentId: '33333333-3333-4333-8333-333333333301',
            quantity: 1,
            unitPrice: 500,
            netAmount: 500,
          },
          {
            serviceCode: 'LAB_CBC',
            description: 'Complete Blood Count (CBC)',
            departmentId: '33333333-3333-4333-8333-333333333307',
            quantity: 1,
            unitPrice: 350,
            netAmount: 350,
          },
          {
            serviceCode: 'RAD_XRAY_CHEST',
            description: 'Chest PA View X-Ray',
            departmentId: '33333333-3333-4333-8333-333333333308',
            quantity: 1,
            unitPrice: 400,
            netAmount: 400,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async createInvoice(
    data: CreateInvoiceInput,
    tenantId: string,
    facilityId: string,
    cashierId: string
  ): Promise<Invoice> {
    const invoiceNumber = `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const total = data.items.reduce(
      (acc, item: InvoiceLineInput) => acc + item.quantity * item.unitPrice,
      0
    );

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      invoiceNumber,
      patientId: data.patientId,
      encounterId: data.encounterId,
      totalGrossAmount: total,
      discountAmount: data.discountAmount || 0,
      taxAmount: data.taxAmount || 0,
      netPayableAmount: total - (data.discountAmount || 0) + (data.taxAmount || 0),
      paidAmount: data.paidAmount || total,
      balanceAmount: 0,
      status: 'PAID',
      // The DTO deliberately withholds `netAmount` (see billing.dto.ts): a
      // client-supplied line total that disagrees with its own quantity and
      // unit price is exactly the discrepancy that surfaces weeks later as an
      // unexplained revenue variance, so the server derives it.
      items: data.items.map((item) => ({
        serviceCode: item.serviceCode,
        description: item.description,
        departmentId: item.departmentId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        netAmount: item.quantity * item.unitPrice,
      })),
      createdAt: new Date().toISOString(),
      createdBy: cashierId,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
