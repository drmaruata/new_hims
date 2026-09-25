import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';

@Injectable()
export class CommandCenterService {
  constructor(private readonly db: DatabaseService) {}

  async getMetrics(tenantId?: string, facilityId?: string) {
    return {
      timestamp: new Date().toISOString(),
      facilityName: 'Apollo Main Hospital - Jubilee Hills',
      occupancy: {
        totalBeds: 250,
        occupiedBeds: 205,
        occupancyRate: 82.0,
        icuBedsOccupied: 22,
        icuBedsTotal: 25,
      },
      opd: {
        registeredToday: 142,
        inConsultation: 18,
        waitingInQueue: 24,
        avgWaitTimeMinutes: 14,
      },
      emergency: {
        activePatients: 16,
        esi1Resuscitation: 1,
        esi2Emergent: 3,
        avgTriageTimeMinutes: 6,
      },
      ot: {
        casesScheduledToday: 12,
        casesCompleted: 7,
        theatresRunning: 4,
        theatresTotal: 6,
      },
      diagnostics: {
        pendingLabSamples: 28,
        criticalLabAlerts: 1,
        pendingRadiologyReads: 9,
      },
      revenue: {
        grossBilledToday: 485000,
        collectionsToday: 412000,
        claimsSubmitted: 18,
        preAuthPending: 4,
      },
    };
  }
}
