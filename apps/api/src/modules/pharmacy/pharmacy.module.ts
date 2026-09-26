import { Module } from '@nestjs/common';
import { PharmacyController } from './pharmacy.controller.js';
import { PharmacyService } from './pharmacy.service.js';

@Module({
  controllers: [PharmacyController],
  providers: [PharmacyService],
  exports: [PharmacyService],
})
export class PharmacyModule {}
