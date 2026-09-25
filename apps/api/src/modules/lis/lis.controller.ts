import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateLabOrderDtoSchema, type CreateLabOrderDto } from '@hims/validation';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { ActiveFacilityId, CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { VerifyLabResultSchema, type VerifyLabResultInput } from './dto/lis.dto.js';
import { LisService } from './lis.service.js';

@ApiTags('LIS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab')
export class LisController {
  constructor(private readonly lisService: LisService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Get laboratory orders and worklist' })
  async getOrders(@Query('status') status: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    const orders = await this.lisService.getOrders(status, user.tenantId, user.activeFacilityId);
    return orders;
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create laboratory order with accessioning' })
  async createOrder(
    @Body(new ZodValidationPipe(CreateLabOrderDtoSchema)) input: CreateLabOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveFacilityId() facilityId: string,
  ) {
    const order = await this.lisService.createOrder(input, user.tenantId, facilityId, user.userId);
    return order;
  }

  @Post('orders/:id/tests/:testCode/verify')
  @ApiOperation({ summary: 'Verify test result and trigger critical-value alert if abnormal' })
  async verifyResult(
    @Param('id') id: string,
    @Param('testCode') testCode: string,
    @Body(new ZodValidationPipe(VerifyLabResultSchema)) input: VerifyLabResultInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updatedOrder = await this.lisService.verifyResult(id, testCode, input, user.userId);
    return updatedOrder;
  }
}



