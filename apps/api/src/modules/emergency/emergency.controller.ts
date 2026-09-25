import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { EmergencyService } from './emergency.service.js';

@ApiTags('Emergency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get('cases')
  @ApiOperation({ summary: 'Get active Emergency Department triage board & cases' })
  async getCases(@CurrentUser() user: any) {
    const cases = await this.emergencyService.getActiveCases(user.tenantId, user.facilityId);
    return { data: cases };
  }

  @Post('triage')
  @ApiOperation({ summary: 'Register and perform triage acuity scoring (ESI 1-5)' })
  async triage(@Body() triageDto: any, @CurrentUser() user: any) {
    const encounter = await this.emergencyService.triage(triageDto, user.tenantId, user.facilityId, user.userId);
    return { data: encounter };
  }
}
