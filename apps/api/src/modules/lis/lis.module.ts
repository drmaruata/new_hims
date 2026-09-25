import { Module } from '@nestjs/common';
import { LisController } from './lis.controller.js';
import { LisService } from './lis.service.js';

@Module({
  controllers: [LisController],
  providers: [LisService],
  exports: [LisService],
})
export class LisModule {}
