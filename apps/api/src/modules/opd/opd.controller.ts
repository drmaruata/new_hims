import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { OpdService } from './opd.service.js';

@ApiTags('OPD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('opd')
export class OpdController {
  constructor(private readonly opdService: OpdService) {}

  @Get('appointments')
  @ApiOperation({ summary: 'Get department and practitioner appointments' })
  async getAppointments(
    @Query('date') date: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: any
  ) {
    const appointments = await this.opdService.getAppointments(date, departmentId, user.tenantId, user.facilityId);
    return { data: appointments };
  }

  @Post('appointments')
  @ApiOperation({ summary: 'Book an OPD appointment' })
  async createAppointment(@Body() createDto: any, @CurrentUser() user: any) {
    const appointment = await this.opdService.createAppointment(createDto, user.tenantId, user.facilityId);
    return { data: appointment };
  }

  @Post('appointments/:id/check-in')
  @ApiOperation({ summary: 'Check-in appointment and generate queue token' })
  async checkIn(@Param('id') id: string, @CurrentUser() user: any) {
    const appointment = await this.opdService.checkIn(id, user.tenantId);
    return { data: appointment };
  }

  @Post('prescriptions')
  @ApiOperation({ summary: 'Create and electronically sign OPD prescription (automatically sent to Pharmacy queue)' })
  async createPrescription(@Body() createDto: any, @CurrentUser() user: any) {
    const prescription = await this.opdService.createPrescription(createDto, user.tenantId, user.facilityId, user.userId);
    return { data: prescription };
  }
}
