import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { BillingService } from './billing.service.js';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoices by patient or encounter' })
  async getInvoices(@Query('patientId') patientId: string, @CurrentUser() user: any) {
    const invoices = await this.billingService.getInvoices(patientId, user.tenantId, user.facilityId);
    return { data: invoices };
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Generate and finalize invoice' })
  async createInvoice(@Body() createDto: any, @CurrentUser() user: any) {
    const invoice = await this.billingService.createInvoice(createDto, user.tenantId, user.facilityId, user.userId);
    return { data: invoice };
  }
}
