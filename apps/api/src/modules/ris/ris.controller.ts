import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { RisService } from './ris.service.js';

@ApiTags('RIS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('radiology')
export class RisController {
  constructor(private readonly risService: RisService) {}

  @Get('worklist')
  @ApiOperation({ summary: 'Get radiology modality worklist and imaging studies' })
  async getWorklist(@CurrentUser() user: any) {
    const worklist = await this.risService.getWorklist(user.tenantId, user.facilityId);
    return { data: worklist };
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create radiology imaging order' })
  async createOrder(@Body() createDto: any, @CurrentUser() user: any) {
    const order = await this.risService.createOrder(createDto, user.tenantId, user.facilityId, user.userId);
    return { data: order };
  }

  @Post('orders/:id/report')
  @ApiOperation({ summary: 'Submit radiologist structured report and verification' })
  async submitReport(@Param('id') id: string, @Body() reportDto: any, @CurrentUser() user: any) {
    const order = await this.risService.submitReport(id, reportDto, user.userId);
    return { data: order };
  }
}
