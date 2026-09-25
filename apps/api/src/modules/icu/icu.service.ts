import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import type { IcuEpisode } from '@hims/domain-types';

@Injectable()
export class IcuService {
  constructor(private readonly db: DatabaseService) {}

  async getEpisodes(tenantId?: string, facilityId?: string): Promise<IcuEpisode[]> {
    return [
      {
        id: '13131313-1313-1313-1313-131313131301',
        tenantId: tenantId || '11111111-1111-1111-1111-111111111111',
        facilityId: facilityId || '22222222-2222-2222-2222-222222222221',
        episodeNumber: 'ICU-2026-0012',
        encounterId: '77777777-7777-7777-7777-777777777703',
        patientId: '99999999-9999-9999-9999-999999999902',
        icuBedId: '20202020-2020-2020-2020-202020202003',
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
