import { Module } from '@nestjs/common';
import { OpdController } from './opd.controller.js';
import { OpdService } from './opd.service.js';

@Module({
  controllers: [OpdController],
  providers: [OpdService],
  exports: [OpdService],
})
export class OpdModule {}

