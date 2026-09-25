import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { AuditService } from './audit.service.js';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @ApiOperation({ summary: 'Query immutable audit log events (access, mutations, break-glass)' })
  async getEvents(@Query('resourceId') resourceId: string, @CurrentUser() user: any) {
    const events = await this.auditService.getEvents(resourceId, user.tenantId);
    return { data: events };
  }

  @Post('break-glass')
  @ApiOperation({ summary: 'Log emergency break-glass clinical record access with required clinical justification' })
  async logBreakGlass(@Body() breakGlassDto: { patientId: string; reason: string }, @CurrentUser() user: any) {
    const log = await this.auditService.logBreakGlass(breakGlassDto.patientId, breakGlassDto.reason, user.tenantId, user.facilityId, user.userId);
    return { data: log };
  }
}
