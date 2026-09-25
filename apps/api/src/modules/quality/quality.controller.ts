import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { ActiveFacilityId, CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { ReportIncidentSchema, type ReportIncidentInput } from './dto/quality.dto.js';
import { QualityService } from './quality.service.js';

@ApiTags('Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('indicators')
  @ApiOperation({ summary: 'Get NABH 6th Edition & NQAS automated Quality Indicators' })
  async getIndicators(@CurrentUser() user: AuthenticatedUser) {
    const indicators = await this.qualityService.getIndicators(user.tenantId, user.activeFacilityId);
    return indicators;
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Report patient safety incident and trigger RCA/CAPA workflow' })
  async reportIncident(
    @Body(new ZodValidationPipe(ReportIncidentSchema)) input: ReportIncidentInput,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
  ) {
    const incident = await this.qualityService.reportIncident(input, user.tenantId, facilityId);
    return incident;
  }
}



