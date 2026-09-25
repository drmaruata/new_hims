import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { ActiveFacilityId, CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { SubmitPreAuthSchema, type SubmitPreAuthInput } from './dto/insurance.dto.js';
import { InsuranceService } from './insurance.service.js';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('claims')
  @ApiOperation({ summary: 'Get government (PM-JAY) and private TPA claims' })
  async getClaims(@CurrentUser() user: AuthenticatedUser) {
    const claims = await this.insuranceService.getClaims(user.tenantId, user.activeFacilityId);
    return claims;
  }

  @Post('pre-auth')
  @ApiOperation({ summary: 'Submit cashless pre-authorization request' })
  async submitPreAuth(
    @Body(new ZodValidationPipe(SubmitPreAuthSchema)) input: SubmitPreAuthInput,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
  ) {
    const claim = await this.insuranceService.submitPreAuth(input, user.tenantId, facilityId);
    return claim;
  }
}



