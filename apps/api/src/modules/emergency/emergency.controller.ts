import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TriageEmergencyDtoSchema, type TriageEmergencyDto } from '@hims/validation';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import {
  ActiveFacilityId,
  CurrentUser,
} from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { EmergencyService } from './emergency.service.js';

@ApiTags('Emergency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get('cases')
  @ApiOperation({ summary: 'Get active Emergency Department triage board & cases' })
  async getCases(@CurrentUser() user: AuthenticatedUser) {
    const cases = await this.emergencyService.getActiveCases(user.tenantId, user.activeFacilityId);
    return cases;
  }

  @Post('triage')
  @ApiOperation({ summary: 'Register and perform triage acuity scoring (ESI 1-5)' })
  async triage(
    @Body(new ZodValidationPipe(TriageEmergencyDtoSchema)) input: TriageEmergencyDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string
  ) {
    // Triage is recorded against the triaging nurse, not the requesting user:
    // in the ED the two are frequently different people.
    const encounter = await this.emergencyService.triage(
      input,
      user.tenantId,
      facilityId,
      user.userId
    );
    return encounter;
  }
}
