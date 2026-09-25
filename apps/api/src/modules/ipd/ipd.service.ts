import { Injectable } from '@nestjs/common';
import type { CreateIpdAdmissionDto, RecordVitalsDto } from '@hims/validation';
import { DatabaseService } from '@hims/database';
import type { Bed, IpdAdmission, ClinicalVitals } from '@hims/domain-types';

@Injectable()
export class IpdService {
  constructor(private readonly db: DatabaseService) {}

  async getBeds(wardId?: string, tenantId?: string | null, facilityId?: string | null): Promise<Bed[]> {
    return [
      {
        id: '20202020-2020-2020-2020-202020202001',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        bedCode: 'MW-101',
        wardId: wardId || '30303030-3030-3030-3030-303030303001',
        departmentId: '33333333-3333-3333-3333-333333333301',
        bedType: 'GENERAL',
        dailyTariff: 1500,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: '20202020-2020-2020-2020-202020202002',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        bedCode: 'MW-102',
        wardId: wardId || '30303030-3030-3030-3030-303030303001',
        departmentId: '33333333-3333-3333-3333-333333333301',
        bedType: 'GENERAL',
        dailyTariff: 1500,
        status: 'OCCUPIED',
        currentPatientId: '99999999-9999-9999-9999-999999999901',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: '20202020-2020-2020-2020-202020202003',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        bedCode: 'ICU-B1',
        wardId: '30303030-3030-3030-3030-303030303002',
        departmentId: '33333333-3333-3333-3333-333333333305',
        bedType: 'ICU',
        dailyTariff: 8000,
        status: 'OCCUPIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: '20202020-2020-2020-2020-202020202004',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        bedCode: 'ICU-B2',
        wardId: '30303030-3030-3030-3030-303030303002',
        departmentId: '33333333-3333-3333-3333-333333333305',
        bedType: 'ICU',
        dailyTariff: 8000,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async getAdmissions(tenantId?: string | null, facilityId?: string | null): Promise<IpdAdmission[]> {
    return [
      {
        id: '40404040-4040-4040-4040-404040404001',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        admissionNumber: 'IPD-2026-0089',
        encounterId: '77777777-7777-7777-7777-777777777702',
        patientId: '99999999-9999-9999-9999-999999999901',
        admittedAt: '2026-09-24T08:30:00.000Z',
        admittingDoctorId: '44444444-4444-4444-4444-444444444401',
        departmentId: '33333333-3333-3333-3333-333333333301',
        wardId: '30303030-3030-3030-3030-303030303001',
        assignedBedId: '20202020-2020-2020-2020-202020202002',
        status: 'ADMITTED',
        createdAt: '2026-09-24T08:30:00.000Z',
        updatedAt: '2026-09-24T08:30:00.000Z',
        version: 1,
      },
    ];
  }

  async admit(
    input: CreateIpdAdmissionDto,
    tenantId: string,
    facilityId: string,
    userId: string,
  ): Promise<IpdAdmission> {
    const admissionNumber = `IPD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      admissionNumber,
      encounterId: crypto.randomUUID(),
      patientId: input.patientId,
      admittedAt: new Date().toISOString(),
      admittingDoctorId: input.admittingDoctorId,
      departmentId: input.departmentId,
      wardId: input.wardId,
      assignedBedId: input.assignedBedId,
      status: 'ADMITTED',
      createdAt: new Date().toISOString(),
      createdBy: userId,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      version: 1,
    };
  }

  async recordVitals(input: RecordVitalsDto, userId: string): Promise<ClinicalVitals> {
    return {
      id: crypto.randomUUID(),
      encounterId: input.encounterId,
      patientId: input.patientId,
      recordedAt: new Date().toISOString(),
      recordedBy: userId,
      pulseBpm: input.pulseBpm,
      systolicBp: input.systolicBp,
      diastolicBp: input.diastolicBp,
      temperatureCelsius: input.temperatureCelsius,
      oxygenSaturationSpO2: input.oxygenSaturationSpO2,
      respiratoryRate: input.respiratoryRate,
      gcsScore: input.gcsScore,
      painScore: input.painScore,
    };
  }
}

