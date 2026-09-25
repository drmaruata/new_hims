import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { PharmacyService } from './pharmacy.service.js';

@ApiTags('Pharmacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('dispense-queue')
  @ApiOperation({ summary: 'Get OPD & IPD medication queue for dispensing' })
  async getDispenseQueue(@CurrentUser() user: any) {
    const queue = await this.pharmacyService.getDispenseQueue(user.tenantId, user.facilityId);
    return { data: queue };
  }

  @Post('dispense/:id')
  @ApiOperation({ summary: 'Dispense medication with batch FEFO validation' })
  async dispense(@Param('id') id: string, @Body() dispenseDto: any, @CurrentUser() user: any) {
    const order = await this.pharmacyService.dispense(id, dispenseDto, user.userId);
    return { data: order };
  }
}
