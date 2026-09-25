import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { OtService } from './ot.service.js';

@ApiTags('OT')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ot')
export class OtController {
  constructor(private readonly otService: OtService) {}

  @Get('schedule')
  @ApiOperation({ summary: 'Get Operating Theatre schedule and active surgical cases' })
  async getSchedule(@Query('date') date: string, @CurrentUser() user: any) {
    const cases = await this.otService.getSchedule(date, user.tenantId, user.facilityId);
    return { data: cases };
  }

  @Post('cases')
  @ApiOperation({ summary: 'Book / Schedule a surgical procedure from IPD or OPD' })
  async bookCase(@Body() createDto: any, @CurrentUser() user: any) {
    const surgeryCase = await this.otService.bookCase(createDto, user.tenantId, user.facilityId);
    return { data: surgeryCase };
  }
}
