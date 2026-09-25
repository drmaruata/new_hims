import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { IntegrationService } from './integration.service.js';

@ApiTags('Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get('abdm/status')
  @ApiOperation({ summary: 'Get ABDM (Milestones 1, 2, 3) gateway connectivity status' })
  async getAbdmStatus() {
    return { data: await this.integrationService.getAbdmStatus() };
  }

  @Post('fhir/patient-summary')
  @ApiOperation({ summary: 'Generate FHIR R4/R5 Patient Resource bundle' })
  async generateFhirBundle(@Body() body: { patientId: string }) {
    return { data: await this.integrationService.generateFhirPatientBundle(body.patientId) };
  }
}
