import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateSurgeryCaseDtoSchema, type CreateSurgeryCaseDto } from '@hims/validation';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import {
  ActiveFacilityId,
  CurrentUser,
} from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { OtService } from './ot.service.js';

@ApiTags('OT')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ot')
export class OtController {
  constructor(private readonly otService: OtService) {}

  @Get('schedule')
  @ApiOperation({ summary: 'Get Operating Theatre schedule and active surgical cases' })
  async getSchedule(
    @Query('date') date: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const cases = await this.otService.getSchedule(date, user.tenantId, user.activeFacilityId);
    return cases;
  }

  @Post('cases')
  @ApiOperation({ summary: 'Book / Schedule a surgical procedure from IPD or OPD' })
  async bookCase(
    @Body(new ZodValidationPipe(CreateSurgeryCaseDtoSchema)) input: CreateSurgeryCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string
  ) {
    const surgeryCase = await this.otService.bookCase(
      input,
      user.tenantId,
      facilityId,
      user.userId
    );
    return surgeryCase;
  }
}
