import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import {
  ActiveFacilityId,
  CurrentUser,
} from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { CreateInvoiceSchema, type CreateInvoiceInput } from './dto/billing.dto.js';
import { BillingService } from './billing.service.js';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoices by patient or encounter' })
  async getInvoices(
    @Query('patientId') patientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const invoices = await this.billingService.getInvoices(
      patientId,
      user.tenantId,
      user.activeFacilityId
    );
    return invoices;
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Generate and finalize invoice' })
  async createInvoice(
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) input: CreateInvoiceInput,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string
  ) {
    const invoice = await this.billingService.createInvoice(
      input,
      user.tenantId,
      facilityId,
      user.userId
    );
    return invoice;
  }
}
