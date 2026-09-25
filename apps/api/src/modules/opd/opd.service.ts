import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { OpdAppointment, OpdPrescription } from '@hims/domain-types';

@Injectable()
export class OpdService {
  constructor(private readonly db: DatabaseService) {}

  async getAppointments(date?: string, departmentId?: string, tenantId?: string, facilityId?: string): Promise<OpdAppointment[]> {
    return [
      {
        id: '12121212-1212-1212-1212-121212121201',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        appointmentNumber: 'APT-2026-001',
        patientId: '99999999-9999-9999-9999-999999999901',
        departmentId: departmentId || '33333333-3333-3333-3333-333333333301',
        practitionerId: '44444444-4444-4444-4444-444444444401',
        scheduledAt: new Date().toISOString(),
        durationMinutes: 15,
        status: 'CHECKED_IN',
        queueToken: 'MED-01',
        reasonForVisit: 'Follow up for hypertension and fever',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    ];
  }

  async createAppointment(data: any, tenantId: string, facilityId: string): Promise<OpdAppointment> {
    const appointmentNumber = `APT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      appointmentNumber,
      patientId: data.patientId,
      departmentId: data.departmentId,
      practitionerId: data.practitionerId,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes || 15,
      status: 'CONFIRMED',
      reasonForVisit: data.reasonForVisit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  async checkIn(id: string, tenantId: string): Promise<OpdAppointment> {
    const token = `MED-${Math.floor(10 + Math.random() * 90)}`;
    return {
      id,
      tenantId,
      facilityId: '22222222-2222-2222-2222-222222222221',
      appointmentNumber: 'APT-2026-001',
      patientId: '99999999-9999-9999-9999-999999999901',
      departmentId: '33333333-3333-3333-3333-333333333301',
      practitionerId: '44444444-4444-4444-4444-444444444401',
      scheduledAt: new Date().toISOString(),
      durationMinutes: 15,
      status: 'CHECKED_IN',
      queueToken: token,
      checkedInAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 2,
    };
  }

  async createPrescription(data: any, tenantId: string, facilityId: string, doctorId: string): Promise<OpdPrescription> {
    const prescriptionNumber = `RX-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      id: crypto.randomUUID(),
      tenantId,
      facilityId,
      prescriptionNumber,
      encounterId: data.encounterId,
      patientId: data.patientId,
      prescribingDoctorId: doctorId,
      prescribedAt: new Date().toISOString(),
      status: 'SIGNED',
      items: data.items.map((item: any) => ({
        id: crypto.randomUUID(),
        ...item,
      })),
      diagnosisText: data.diagnosisText,
      clinicalNotes: data.clinicalNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
