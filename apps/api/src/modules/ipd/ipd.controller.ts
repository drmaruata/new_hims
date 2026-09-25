import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateIpdAdmissionDtoSchema,
  RecordVitalsDtoSchema,
  type CreateIpdAdmissionDto,
  type RecordVitalsDto,
} from '@hims/validation';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { ActiveFacilityId, CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { IpdService } from './ipd.service.js';

@ApiTags('IPD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ipd')
export class IpdController {
  constructor(private readonly ipdService: IpdService) {}

  @Get('beds')
  @ApiOperation({ summary: 'Get ward and bed status board' })
  async getBeds(@Query('wardId') wardId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    const beds = await this.ipdService.getBeds(wardId, user.tenantId, user.activeFacilityId);
    return beds;
  }

  @Get('admissions')
  @ApiOperation({ summary: 'Get active inpatient admissions' })
  async getAdmissions(@CurrentUser() user: AuthenticatedUser) {
    const admissions = await this.ipdService.getAdmissions(user.tenantId, user.activeFacilityId);
    return admissions;
  }

  @Post('admissions')
  @ApiOperation({ summary: 'Admit patient to IPD bed' })
  async admit(
    @Body(new ZodValidationPipe(CreateIpdAdmissionDtoSchema)) input: CreateIpdAdmissionDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
  ) {
    const admission = await this.ipdService.admit(input, user.tenantId, facilityId, user.userId);
    return admission;
  }

  @Post('vitals')
  @ApiOperation({ summary: 'Record inpatient clinical vitals' })
  async recordVitals(
    @Body(new ZodValidationPipe(RecordVitalsDtoSchema)) input: RecordVitalsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const vitals = await this.ipdService.recordVitals(input, user.userId);
    return vitals;
  }
}



