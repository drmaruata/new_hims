import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@hims/database';

@Injectable()
export class IntegrationService {
  constructor(private readonly db: DatabaseService) {}

  async getAbdmStatus() {
    return {
      connected: true,
      milestones: {
        m1_abha_creation_verification: 'ACTIVE',
        m2_hip_health_record_linking: 'ACTIVE',
        m3_hiu_consent_data_view: 'ACTIVE',
      },
      gatewayEndpoint: 'https://dev.abdm.gov.in/gateway',
      lastHeartbeat: new Date().toISOString(),
    };
  }

  async generateFhirPatientBundle(patientId: string) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: patientId,
            identifier: [
              {
                system: 'https://healthid.ndhm.gov.in',
                value: '91-1234-5678-9012',
              },
            ],
            name: [{ family: 'Sharma', given: ['Aarav'] }],
            gender: 'male',
            birthDate: '1990-05-15',
          },
        },
      ],
    };
  }
}

