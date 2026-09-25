import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { LisService } from './lis.service.js';

@ApiTags('LIS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab')
export class LisController {
  constructor(private readonly lisService: LisService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Get laboratory orders and worklist' })
  async getOrders(@Query('status') status: string, @CurrentUser() user: any) {
    const orders = await this.lisService.getOrders(status, user.tenantId, user.facilityId);
    return { data: orders };
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create laboratory order with accessioning' })
  async createOrder(@Body() createDto: any, @CurrentUser() user: any) {
    const order = await this.lisService.createOrder(createDto, user.tenantId, user.facilityId, user.userId);
    return { data: order };
  }

  @Post('orders/:id/tests/:testCode/verify')
  @ApiOperation({ summary: 'Verify test result and trigger critical-value alert if abnormal' })
  async verifyResult(
    @Param('id') id: string,
    @Param('testCode') testCode: string,
    @Body() resultDto: any,
    @CurrentUser() user: any
  ) {
    const updatedOrder = await this.lisService.verifyResult(id, testCode, resultDto, user.userId);
    return { data: updatedOrder };
  }
}
