import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';

import { DatabaseService } from '@hims/database';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Liveness and readiness are deliberately different questions, and conflating
 * them is a classic way to turn a database blip into a cluster-wide restart.
 *
 *   /health  (liveness)  "is this process wedged?"   -> depends on nothing
 *   /health/ready       "should it receive traffic?" -> depends on PostgreSQL
 *
 * A liveness probe that touches the database gets the pod killed whenever the
 * database is slow, which is exactly when the pod is needed least and the
 * database can least afford a thundering herd of reconnects. So liveness
 * answers from process-local state only.
 */
@ApiTags('Platform')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly db: DatabaseService,
  ) {}

  @Get()
  @Public()
  @ApiExcludeEndpoint()
  live() {
    return {
      status: 'ok',
      service: 'hims-api',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiExcludeEndpoint()
  async ready() {
    return this.health.check([
      // `attempt` marks the indicator up or down based on whether the callback
      // throws, so a rejection is reported as `down` and readiness answers 503.
      // The timeout bounds how long a hung connection can stall a probe.
      this.indicators
        .check('database')
        .attempt(async () => {
          if (!(await this.db.ping())) {
            throw new Error('Database ping failed');
          }
        })
        .withTimeout(2_000),
    ]);
  }
}
