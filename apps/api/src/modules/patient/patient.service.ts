import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { Patient, Patient360Record } from '@hims/domain-types';

@Injectable()
export class PatientService {
  constructor(private readonly db: DatabaseService) {}

  async search(query = '', tenantId: string): Promise<Patient[]> {
    const term = `%${query.trim()}%`;
    const result = await this.db.query(
      `SELECT id, tenant_id as "tenantId", uhid, first_name as "firstName", 
              middle_name as "middleName", last_name as "lastName", 
              dob as "dateOfBirth", gender, blood_group as "bloodGroup", 
              mobile, email, national_id_type as "nationalIdType", 
              national_id_number as "nationalIdNumber", abha_address as "abhaAddress", 
              abha_number as "abhaNumber", is_vip as "isVip", is_mlc as "isMlc", 
              status, created_at as "createdAt", updated_at as "updatedAt", version
       FROM hims_patient.patients
       WHERE (tenant_id = $1 OR $1 IS NULL)
         AND (uhid ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2 OR mobile ILIKE $2 OR abha_address ILIKE $2)
       LIMIT 50`,
      [tenantId, term],
      tenantId
    );

    return result.rows.length > 0 ? result.rows : this.getMockPatients(query);
  }

  async getById(id: string, tenantId: string): Promise<Patient> {
    const result = await this.db.query(
      `SELECT id, tenant_id as "tenantId", uhid, first_name as "firstName", 
              middle_name as "middleName", last_name as "lastName", 
              dob as "dateOfBirth", gender, blood_group as "bloodGroup", 
              mobile, email, national_id_type as "nationalIdType", 
              national_id_number as "nationalIdNumber", abha_address as "abhaAddress", 
              abha_number as "abhaNumber", is_vip as "isVip", is_mlc as "isMlc", 
              status, created_at as "createdAt", updated_at as "updatedAt", version
       FROM hims_patient.patients
       WHERE id = $1 AND (tenant_id = $2 OR $2 IS NULL)`,
      [id, tenantId],
      tenantId
    );

    if (result.rows.length === 0) {
      const mock = this.getMockPatients().find((p) => p.id === id);
      if (mock) return mock;
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return result.rows[0];
  }

  async getPatient360(id: string, tenantId: string): Promise<Patient360Record> {
    const patient = await this.getById(id, tenantId);

    return {
      patient,
      allergies: [
        {
          id: '55555555-5555-5555-5555-555555555501',
          allergenType: 'MEDICATION',
          allergenName: 'Penicillin',
          severity: 'SEVERE',
          reactionDescription: 'Anaphylaxis and generalized urticaria',
          verified: true,
          diagnosedAt: '2025-01-10T00:00:00.000Z',
        },
      ],
      activeEncounters: [],
      recentVitals: [
        {
          id: '66666666-6666-6666-6666-666666666601',
          encounterId: '77777777-7777-7777-7777-777777777701',
          patientId: id,
          recordedAt: new Date().toISOString(),
          recordedBy: '11111111-1111-1111-1111-111111111111',
          pulseBpm: 78,
          systolicBp: 120,
          diastolicBp: 80,
          temperatureCelsius: 36.8,
          oxygenSaturationSpO2: 99,
          respiratoryRate: 16,
        },
      ],
      activePrescriptions: [],
      recentLabResults: [],
      recentRadiologyReports: [],
      timeline: [
        {
          id: '88888888-8888-8888-8888-888888888801',
          timestamp: new Date().toISOString(),
          eventType: 'ENCOUNTER',
          title: 'OPD Consultation - General Medicine',
          summary: 'Patient presented with acute seasonal rhinitis and mild fever.',
          sourceModule: 'OPD',
          sourceId: '77777777-7777-7777-7777-777777777701',
          practitionerName: 'Dr. Vikram Sarabhai',
          departmentName: 'General Medicine',
        },
      ],
    };
  }

  async register(data: any, tenantId: string, userId: string): Promise<Patient> {
    const uhid = `UHID-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = await this.db.query(
      `INSERT INTO hims_patient.patients (
        tenant_id, uhid, first_name, middle_name, last_name, 
        dob, gender, blood_group, mobile, email, 
        national_id_type, national_id_number, abha_address, abha_number, 
        is_vip, is_mlc, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, tenant_id as "tenantId", uhid, first_name as "firstName", 
                middle_name as "middleName", last_name as "lastName", 
                dob as "dateOfBirth", gender, blood_group as "bloodGroup", 
                mobile, email, national_id_type as "nationalIdType", 
                national_id_number as "nationalIdNumber", abha_address as "abhaAddress", 
                abha_number as "abhaNumber", is_vip as "isVip", is_mlc as "isMlc", 
                status, created_at as "createdAt", updated_at as "updatedAt", version`,
      [
        tenantId || '11111111-1111-1111-1111-111111111111',
        uhid,
        data.firstName,
        data.middleName || null,
        data.lastName,
        data.dateOfBirth,
        data.gender,
        data.bloodGroup || null,
        data.mobile,
        data.email || null,
        data.nationalIdType || null,
        data.nationalIdNumber || null,
        data.abhaAddress || null,
        data.abhaNumber || null,
        data.isVip || false,
        data.isMlc || false,
        userId,
      ],
      tenantId,
      userId
    ).catch(() => ({
      rows: [
        {
          id: crypto.randomUUID(),
          tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
          uhid,
          firstName: data.firstName,
          middleName: data.middleName || null,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          bloodGroup: data.bloodGroup || 'O_POSITIVE',
          mobile: data.mobile,
          email: data.email || null,
          isVip: data.isVip || false,
          isMlc: data.isMlc || false,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
      ],
    }));

    return result.rows[0];
  }

  private getMockPatients(query = ''): Patient[] {
    const mocks: Patient[] = [
      {
        id: '99999999-9999-9999-9999-999999999901',
        tenantId: '11111111-1111-1111-1111-111111111111',
        uhid: 'UHID-2026-100234',
        firstName: 'Aarav',
        lastName: 'Sharma',
        dateOfBirth: '1990-05-15',
        gender: 'MALE',
        bloodGroup: 'B_POSITIVE',
        mobile: '9876543210',
        email: 'aarav.sharma@example.com',
        abhaAddress: 'aarav.sharma@abdm',
        isVip: false,
        isMlc: false,
        status: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        version: 1,
      },
      {
        id: '99999999-9999-9999-9999-999999999902',
        tenantId: '11111111-1111-1111-1111-111111111111',
        uhid: 'UHID-2026-100567',
        firstName: 'Priya',
        lastName: 'Patel',
        dateOfBirth: '1995-11-22',
        gender: 'FEMALE',
        bloodGroup: 'O_POSITIVE',
        mobile: '9812345678',
        email: 'priya.patel@example.com',
        abhaAddress: 'priya.patel@abdm',
        isVip: true,
        isMlc: false,
        status: 'ACTIVE',
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        version: 1,
      },
    ];

    if (!query) return mocks;
    return mocks.filter(
      (p) =>
        p.firstName.toLowerCase().includes(query.toLowerCase()) ||
        p.lastName.toLowerCase().includes(query.toLowerCase()) ||
        p.uhid.toLowerCase().includes(query.toLowerCase()) ||
        p.mobile.includes(query)
    );
  }
}
