import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateRadiologyOrderDtoSchema, type CreateRadiologyOrderDto } from '@hims/validation';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { ActiveFacilityId, CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { SubmitRadiologyReportSchema, type SubmitRadiologyReportInput } from './dto/ris.dto.js';
import { RisService } from './ris.service.js';

@ApiTags('RIS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('radiology')
export class RisController {
  constructor(private readonly risService: RisService) {}

  @Get('worklist')
  @ApiOperation({ summary: 'Get radiology modality worklist and imaging studies' })
  async getWorklist(@CurrentUser() user: AuthenticatedUser) {
    const worklist = await this.risService.getWorklist(user.tenantId, user.activeFacilityId);
    return worklist;
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create radiology imaging order' })
  async createOrder(
    @Body(new ZodValidationPipe(CreateRadiologyOrderDtoSchema)) input: CreateRadiologyOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
  ) {
    const order = await this.risService.createOrder(input, user.tenantId, facilityId, user.userId);
    return order;
  }

  @Post('orders/:id/report')
  @ApiOperation({ summary: 'Submit radiologist structured report and verification' })
  async submitReport(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubmitRadiologyReportSchema)) input: SubmitRadiologyReportInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.risService.submitReport(id, input, user.userId);
    return order;
  }
}



