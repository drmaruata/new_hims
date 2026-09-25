import { Module } from '@nestjs/common';

import { EncounterController } from './encounter.controller.js';
import { EncounterService } from './encounter.service.js';

@Module({
  controllers: [EncounterController],
  providers: [EncounterService],
  exports: [EncounterService],
})
export class EncounterModule {}
