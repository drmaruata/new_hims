import { Module } from '@nestjs/common';
import { EmrController } from './emr.controller.js';
import { EmrService } from './emr.service.js';

@Module({
  controllers: [EmrController],
  providers: [EmrService],
  exports: [EmrService],
})
export class EmrModule {}
