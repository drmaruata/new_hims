import { Module } from '@nestjs/common';
import { InsuranceController } from './insurance.controller.js';
import { InsuranceService } from './insurance.service.js';

@Module({
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
