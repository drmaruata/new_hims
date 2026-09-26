import { randomUUID } from 'node:crypto';

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';

import { BreakGlassDtoSchema, type BreakGlassDto } from '@hims/validation';
import type { DatabaseContext } from '@hims/database';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import {
  ActiveFacilityId,
  CurrentUser,
  DbContext,
} from '../../core/auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @RequirePermissions('SYSTEM:AUDIT:READ:TENANT')
  @ApiOperation({
    summary: 'Query immutable audit log events (access, mutations, break-glass)',
  })
  async getEvents(
    @Query('resourceId', new ZodValidationPipe(z.string().uuid().optional())) resourceId: string | undefined,
    @DbContext() ctx: DatabaseContext,
  ) {
    return this.auditService.getEvents(resourceId, ctx);
  }

  @Post('break-glass')
  @RequirePermissions('SYSTEM:BREAK_GLASS:USE:FACILITY')
  @ApiOperation({
    summary: 'Log emergency break-glass clinical record access with required clinical justification',
  })
  async logBreakGlass(
    @Body(new ZodValidationPipe(BreakGlassDtoSchema)) input: BreakGlassDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
    @Req() request: Request,
  ) {
    return this.auditService.logBreakGlass({
      patientId: input.patientId,
      reason: input.reason,
      ctx: {
        tenantId: user.tenantId,
        facilityId,
        userId: user.userId,
        isTenantAdmin: user.isTenantAdmin,
      },
      actorRole: user.roles[0] ?? 'UNKNOWN',
      correlationId: String((request as Request & { correlationId?: string }).correlationId ?? randomUUID()),
      ipAddress: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }
}
