import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BreakGlassDtoSchema, type BreakGlassDto } from '@hims/validation';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { ActiveFacilityId, CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { AuditService } from './audit.service.js';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @ApiOperation({ summary: 'Query immutable audit log events (access, mutations, break-glass)' })
  async getEvents(
    @Query('resourceId') resourceId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const events = await this.auditService.getEvents(resourceId, user.tenantId);
    return events;
  }

  @Post('break-glass')
  @ApiOperation({ summary: 'Log emergency break-glass clinical record access with required clinical justification' })
  async logBreakGlass(
    @Body(new ZodValidationPipe(BreakGlassDtoSchema)) input: BreakGlassDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
  ) {
    // Every break-glass read is attributed to the facility the clinician was
    // working in, not to whichever facility the record belongs to.
    const log = await this.auditService.logBreakGlass(
      input.patientId,
      input.reason,
      user.tenantId,
      facilityId,
      user.userId,
    );
    return log;
  }
}



