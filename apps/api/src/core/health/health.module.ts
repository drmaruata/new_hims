import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller.js';

/**
 * Liveness and readiness endpoints.
 *
 * Readiness treats an unreachable PostgreSQL as `down`, which answers 503 and
 * takes the pod out of the load balancer's rotation while the rest of the
 * platform keeps serving. It is deliberately *not* marked `degraded`: a pod
 * that cannot reach its database cannot serve a request, and reporting 200
 * would keep routing traffic to it.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
