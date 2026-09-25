import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { QualityService } from './quality.service.js';

@ApiTags('Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('indicators')
  @ApiOperation({ summary: 'Get NABH 6th Edition & NQAS automated Quality Indicators' })
  async getIndicators(@CurrentUser() user: any) {
    const indicators = await this.qualityService.getIndicators(user.tenantId, user.facilityId);
    return { data: indicators };
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Report patient safety incident and trigger RCA/CAPA workflow' })
  async reportIncident(@Body() createDto: any, @CurrentUser() user: any) {
    const incident = await this.qualityService.reportIncident(createDto, user.tenantId, user.facilityId);
    return { data: incident };
  }
}
