import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { EmrService } from './emr.service.js';

@ApiTags('EMR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emr')
export class EmrController {
  constructor(private readonly emrService: EmrService) {}

  @Get('patients/:id/timeline')
  @ApiOperation({ summary: 'Get unified cross-department provenance-aware longitudinal timeline' })
  async getTimeline(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const timeline = await this.emrService.getTimeline(id, user.tenantId);
    return timeline;
  }
}
