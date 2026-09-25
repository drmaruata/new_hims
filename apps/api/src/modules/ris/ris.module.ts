import { Module } from '@nestjs/common';
import { RisController } from './ris.controller.js';
import { RisService } from './ris.service.js';

@Module({
  controllers: [RisController],
  providers: [RisService],
  exports: [RisService],
})
export class RisModule {}

