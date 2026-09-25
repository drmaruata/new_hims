import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { PatientService } from './patient.service.js';

@ApiTags('Patient')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  @ApiOperation({ summary: 'Search patients by UHID, Name, Mobile or ABHA' })
  async search(@Query('search') search: string, @CurrentUser() user: any) {
    const patients = await this.patientService.search(search, user.tenantId);
    return { data: patients };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  async getById(@Param('id') id: string, @CurrentUser() user: any) {
    const patient = await this.patientService.getById(id, user.tenantId);
    return { data: patient };
  }

  @Get(':id/360')
  @ApiOperation({ summary: 'Get unified Patient 360 longitudinal medical record' })
  async get360(@Param('id') id: string, @CurrentUser() user: any) {
    const record = await this.patientService.getPatient360(id, user.tenantId);
    return { data: record };
  }

  @Post()
  @ApiOperation({ summary: 'Register a new patient with canonical UHID' })
  async register(@Body() createDto: any, @CurrentUser() user: any) {
    const patient = await this.patientService.register(createDto, user.tenantId, user.userId);
    return { data: patient };
  }
}
