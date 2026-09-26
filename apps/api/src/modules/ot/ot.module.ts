import { Module } from '@nestjs/common';
import { OtController } from './ot.controller.js';
import { OtService } from './ot.service.js';

@Module({
  controllers: [OtController],
  providers: [OtService],
  exports: [OtService],
})
export class OtModule {}
