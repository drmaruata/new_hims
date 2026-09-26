import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@hims/database';
import type { IcuEpisode } from '@hims/domain-types';

@Injectable()
export class IcuService {
  constructor(private readonly db: DatabaseService) {}

  async getEpisodes(tenantId?: string, facilityId?: string | null): Promise<IcuEpisode[]> {
    return [
      {
        id: '13131313-1313-4313-8313-131313131301',
        tenantId: tenantId || '11111111-1111-4111-8111-111111111111',
        facilityId: facilityId || '22222222-2222-4222-8222-222222222221',
        episodeNumber: 'ICU-2026-0012',
        encounterId: '77777777-7777-4777-8777-777777777703',
        patientId: '99999999-9999-4999-8999-999999999902',
        icuBedId: '20202020-2020-4020-8020-202020202003',
        admittedAt: '2026-09-24T22:00:00.000Z',
        intubated: true,
        ventilatorMode: 'SIMV + PS',
        apacheScore: 18,
        sofaScore: 4,
        status: 'ACTIVE',
        createdAt: '2026-09-24T22:00:00.000Z',
        updatedAt: '2026-09-24T22:00:00.000Z',
        version: 1,
      },
    ];
  }
}
