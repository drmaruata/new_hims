import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { IpdService } from './ipd.service.js';

@ApiTags('IPD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ipd')
export class IpdController {
  constructor(private readonly ipdService: IpdService) {}

  @Get('beds')
  @ApiOperation({ summary: 'Get ward and bed status board' })
  async getBeds(@Query('wardId') wardId: string, @CurrentUser() user: any) {
    const beds = await this.ipdService.getBeds(wardId, user.tenantId, user.facilityId);
    return { data: beds };
  }

  @Get('admissions')
  @ApiOperation({ summary: 'Get active inpatient admissions' })
  async getAdmissions(@CurrentUser() user: any) {
    const admissions = await this.ipdService.getAdmissions(user.tenantId, user.facilityId);
    return { data: admissions };
  }

  @Post('admissions')
  @ApiOperation({ summary: 'Admit patient to IPD bed' })
  async admit(@Body() createDto: any, @CurrentUser() user: any) {
    const admission = await this.ipdService.admit(createDto, user.tenantId, user.facilityId, user.userId);
    return { data: admission };
  }

  @Post('vitals')
  @ApiOperation({ summary: 'Record inpatient clinical vitals' })
  async recordVitals(@Body() vitalsDto: any, @CurrentUser() user: any) {
    const vitals = await this.ipdService.recordVitals(vitalsDto, user.userId);
    return { data: vitals };
  }
}
