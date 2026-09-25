import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { DispenseMedicationSchema, type DispenseMedicationInput } from './dto/pharmacy.dto.js';
import { PharmacyService } from './pharmacy.service.js';

@ApiTags('Pharmacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('dispense-queue')
  @ApiOperation({ summary: 'Get OPD & IPD medication queue for dispensing' })
  async getDispenseQueue(@CurrentUser() user: AuthenticatedUser) {
    const queue = await this.pharmacyService.getDispenseQueue(user.tenantId, user.activeFacilityId);
    return queue;
  }

  @Post('dispense/:id')
  @ApiOperation({ summary: 'Dispense medication with batch FEFO validation' })
  async dispense(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DispenseMedicationSchema)) input: DispenseMedicationInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.pharmacyService.dispense(id, input, user.userId);
    return order;
  }
}



