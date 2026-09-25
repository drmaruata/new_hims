import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiGatewayService } from './ai.service.js';

@Module({
  controllers: [AiController],
  providers: [AiGatewayService],
  exports: [AiGatewayService],
})
export class AiModule {}

