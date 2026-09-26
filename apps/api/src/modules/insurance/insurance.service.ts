import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@hims/database';
import type { InsuranceClaim } from '@hims/domain-types';
import type { SubmitPreAuthInput } from './dto/insurance.dto.js';

@Injectable()
export class InsuranceService {
  constructor(private readonly db: DatabaseService) {}

  async getClaims(tenantId?: string, facilityId?: string | null): Promise<InsuranceClaim[]> {
    return [
      {
        id: '17171717-1717-4717-8717-171717171701',
        tenantId: tenantId || '11111111-1111-4111-8111-111111111111',
        facilityId: facilityId || '22222222-2222-4222-8222-222222222221',
        claimNumber: 'CLM-2026-00452',
        encounterId: '77777777-7777-4777-8777-777777777702',
        patientId: '99999999-9999-4999-8999-999999999901',
        payerType: 'PMJAY',
        payerName: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana',
        policyNumber: 'AB-PMJAY-10928374',
        preAuthAmountRequested: 45000,
        preAuthAmountApproved: 45000,
        totalClaimAmount: 45000,
        approvedClaimAmount: 45000,
        status: 'APPROVED',
        submittedAt: '2026-09-24T10:00:00.000Z',
        createdAt: '2026-09-24T10:00:00.000Z',
        updatedAt: '2026-09-24T14:30:00.000Z',
        version: 2,
      },
    ];
  }

  async submitPreAuth(
    data: SubmitPreAuthInput,
    tenantId: string,
    facilityId: string
  ): Promise<InsuranceClaim> {
    const claimNumber = `CLM-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      claimNumber,
      encounterId: data.encounterId,
      patientId: data.patientId,
      payerType: data.payerType || 'PMJAY',
      payerName: data.payerName || 'State Health Insurance Scheme',
      policyNumber: data.policyNumber,
      preAuthAmountRequested: data.requestedAmount,
      totalClaimAmount: data.requestedAmount,
      status: 'PRE_AUTH_SUBMITTED',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
