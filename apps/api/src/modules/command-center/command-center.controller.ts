import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CommandCenterService } from './command-center.service.js';
import { CurrentUser, DbContext } from '../../core/auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../core/auth/guards/tenant.guard.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import type { DatabaseContext } from '@hims/database';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';

@ApiTags('Command Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('command-center')
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  /**
   * The roll-up is a facility-wide view of bed occupancy, the queue, the
   * emergency department and today's revenue — it is a read of the whole site,
   * not one patient's record, so it is gated on an explicit management
   * permission rather than on holding any clinical permission at all.
   */
  @Get('metrics')
  @RequirePermissions('PLATFORM:ANALYTICS:READ:FACILITY')
  @ApiOperation({
    summary: 'Hospital command centre operational, clinical and financial KPIs',
    description:
      'Computed live from the owning tables. Day boundaries are resolved in the ' +
      "facility's own timezone. No cache: a stale command centre number is worse " +
      'than a slow one.',
  })
  async getMetrics(
    @DbContext() ctx: DatabaseContext,
    @CurrentUser() _user: AuthenticatedUser,
  ) {
    return this.commandCenterService.getMetrics(ctx);
  }
}
