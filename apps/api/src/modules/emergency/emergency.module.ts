import { Module } from '@nestjs/common';
import { EmergencyController } from './emergency.controller.js';
import { EmergencyService } from './emergency.service.js';

@Module({
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
