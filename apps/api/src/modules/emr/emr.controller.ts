import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { EmrService } from './emr.service.js';

@ApiTags('EMR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emr')
export class EmrController {
  constructor(private readonly emrService: EmrService) {}

  @Get('patients/:id/timeline')
  @ApiOperation({ summary: 'Get unified cross-department provenance-aware longitudinal timeline' })
  async getTimeline(@Param('id') id: string, @CurrentUser() user: any) {
    const timeline = await this.emrService.getTimeline(id, user.tenantId);
    return { data: timeline };
  }
}
