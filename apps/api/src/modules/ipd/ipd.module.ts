import { Module } from '@nestjs/common';
import { IpdController } from './ipd.controller.js';
import { IpdService } from './ipd.service.js';

@Module({
  controllers: [IpdController],
  providers: [IpdService],
  exports: [IpdService],
})
export class IpdModule {}
