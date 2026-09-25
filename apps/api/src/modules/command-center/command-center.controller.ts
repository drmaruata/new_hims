import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { CommandCenterService } from './command-center.service.js';

@ApiTags('Command Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('command-center')
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get unified hospital command center operational, clinical and financial KPIs' })
  async getMetrics(@CurrentUser() user: any) {
    const metrics = await this.commandCenterService.getMetrics(user.tenantId, user.facilityId);
    return { data: metrics };
  }
}
