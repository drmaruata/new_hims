import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { InsuranceService } from './insurance.service.js';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('claims')
  @ApiOperation({ summary: 'Get government (PM-JAY) and private TPA claims' })
  async getClaims(@CurrentUser() user: any) {
    const claims = await this.insuranceService.getClaims(user.tenantId, user.facilityId);
    return { data: claims };
  }

  @Post('pre-auth')
  @ApiOperation({ summary: 'Submit cashless pre-authorization request' })
  async submitPreAuth(@Body() preAuthDto: any, @CurrentUser() user: any) {
    const claim = await this.insuranceService.submitPreAuth(preAuthDto, user.tenantId, user.facilityId);
    return { data: claim };
  }
}
